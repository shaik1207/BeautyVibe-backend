
const {
  Op,
  UniqueConstraintError,
} = require("sequelize");

const { randomUUID } = require("crypto");

const sequelize = require("../config/database");
const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
const User = require("../models/User");

// ======================================================
// HELPERS
// ======================================================

const sendError = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message,
  });
};

const getAuthenticatedUserId = (req) => {
  const id = Number(req.user?.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

const normalizeServiceId = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "undefined" ||
    value === "null"
  ) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
};

const getRequestId = (req) => {
  const value =
    req.get("Idempotency-Key") ||
    req.body?.requestId;

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return randomUUID();
  }

  const requestId = String(value).trim();

  if (requestId.length > 100) {
    return null;
  }

  return requestId;
};

const formatAppointment = (appointment) => {
  const plain = appointment.get
    ? appointment.get({ plain: true })
    : appointment;

  const service = plain.service || null;
  const user = plain.user || null;

  return {
    id: plain.id,
    _id: plain.id,

    serviceId: plain.serviceId ?? null,

    passCode:
      plain.passCode || `PASS-${plain.id}`,

    requestId:
      plain.requestId || `REQ-${plain.id}`,

    serviceName:
      service?.name ||
      plain.serviceName ||
      "Service information unavailable",

    category:
      service?.category ||
      plain.category ||
      "General",

    amount:
      plain.amount === null ||
      plain.amount === undefined
        ? null
        : Number(plain.amount),

    type: plain.type || "SALON",

    date: plain.date || null,
    time: plain.time || null,

    status: plain.status || "Pending",

    assignedStaff: plain.assignedStaff || "",

    user: user
      ? {
          id: user.id,
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          avatar: user.avatar || "",
        }
      : {
          name: "Customer information unavailable",
          email: "",
          phone: "",
          avatar: "",
        },

    createdAt: plain.createdAt || null,
  };
};

// ======================================================
// GET USER APPOINTMENTS
// ======================================================

exports.getUserAppointments = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return sendError(
        res,
        401,
        "Authentication required."
      );
    }

    const isAdmin = req.user?.role === "admin";

    const appointments = await Appointment.findAll({
      where: isAdmin ? {} : { userId },

      include: [
        {
          model: Service,
          as: "service",
          attributes: [
            "id",
            "name",
            "category",
            "duration",
            "image",
          ],
          required: false,
        },
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "name",
            "email",
            "phone",
            "avatar",
          ],
          required: false,
        },
      ],

      order: [
        ["createdAt", "DESC"],
      ],
    });

    const formatted = appointments.map(
      formatAppointment
    );

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });

  } catch (error) {
    console.error(
      "[BeautyVibe] Get appointments failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve appointments.",
    });
  }
};

// ======================================================
// GET BOOKED SLOTS
// ======================================================

exports.getBookedSlots = async (req, res) => {
  try {
    const { date } = req.query;

    if (
      typeof date !== "string" ||
      !date.trim()
    ) {
      return sendError(
        res,
        400,
        "Date query parameter is required."
      );
    }

    const bookedAppointments =
      await Appointment.findAll({
        where: {
          date: date.trim(),

          status: {
            [Op.ne]: "Cancelled",
          },
        },

        attributes: [
          "time",
          "date",
        ],
      });

    const bookedSlots = bookedAppointments.map(
      (appointment) => appointment.time
    );

    return res.status(200).json({
      success: true,
      data: bookedSlots,
    });

  } catch (error) {
    console.error(
      "[BeautyVibe] Get booked slots failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve booked slots.",
    });
  }
};

// ======================================================
// CREATE APPOINTMENT
// ======================================================

exports.createAppointment = async (req, res) => {
  let transaction = null;

  const requestId = getRequestId(req);

  try {
    // 1. Verify authenticated customer.

    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return sendError(
        res,
        401,
        "Authentication required. Please log in again."
      );
    }

    // 2. Validate request ID.

    if (!requestId) {
      return sendError(
        res,
        400,
        "Invalid booking request ID."
      );
    }

    // 3. Read booking information.

    const {
      serviceId,
      date,
      time,
      type,
    } = req.body || {};

    if (
      typeof date !== "string" ||
      !date.trim() ||
      typeof time !== "string" ||
      !time.trim()
    ) {
      return sendError(
        res,
        400,
        "Please provide appointment date and time."
      );
    }

    // 4. Validate the actual database service ID.

    const validServiceId =
      normalizeServiceId(serviceId);

    if (!validServiceId) {
      return sendError(
        res,
        400,
        "A valid service ID is required. Please select your service again."
      );
    }

    // 5. Check for an existing booking.

    const existingAppointment =
      await Appointment.findOne({
        where: {
          requestId,
        },
      });

    if (existingAppointment) {
      if (
        Number(existingAppointment.userId) !== userId
      ) {
        return sendError(
          res,
          409,
          "This booking request ID belongs to another account."
        );
      }

      return res.status(200).json({
        success: true,
        duplicateRequest: true,
        message: "Existing appointment recovered.",
        data: formatAppointment(existingAppointment),
      });
    }

    // 6. Start transaction.

    transaction = await sequelize.transaction();

    // 7. Verify service exists.

    const service = await Service.findByPk(
      validServiceId,
      {
        transaction,
      }
    );

    if (!service) {
      await transaction.rollback();
      transaction = null;

      return sendError(
        res,
        404,
        "Selected service was not found in the database. Please refresh Services and select it again."
      );
    }

    // 8. Verify customer exists.

    const user = await User.findByPk(
      userId,
      {
        transaction,
      }
    );

    if (!user) {
      await transaction.rollback();
      transaction = null;

      return sendError(
        res,
        401,
        "Customer account not found. Please log in again."
      );
    }

    // 9. Calculate price from database.

    const finalAmount = Number(service.price);

    if (
      !Number.isFinite(finalAmount) ||
      finalAmount < 0
    ) {
      await transaction.rollback();
      transaction = null;

      return sendError(
        res,
        400,
        "The selected service has an invalid database price."
      );
    }

    // Apply any discounts or travel charges here,
    // calculated and validated on the backend.

    const finalType =
      type === "SALON" ? "SALON" : "HOME";

    const passCode =
      `PASS-${randomUUID()
        .replace(/-/g, "")
        .slice(0, 8)
        .toUpperCase()}`;

    // 10. Create appointment.

    const appointment = await Appointment.create(
      {
        userId: user.id,

        serviceId: service.id,

        serviceName: service.name,

        category:
          service.category || "General",

        amount: finalAmount,

        type: finalType,

        date: date.trim(),

        time: time.trim(),

        status: "Pending",

        assignedStaff: "",

        passCode,

        requestId,
      },
      {
        transaction,
      }
    );

    // 11. Commit.

    await transaction.commit();
    transaction = null;

    // 12. Retrieve full appointment after commit.

    const savedAppointment =
      await Appointment.findByPk(
        appointment.id,
        {
          include: [
            {
              model: Service,
              as: "service",
              attributes: [
                "id",
                "name",
                "category",
                "duration",
                "image",
              ],
              required: false,
            },
            {
              model: User,
              as: "user",
              attributes: [
                "id",
                "name",
                "email",
                "phone",
                "avatar",
              ],
              required: false,
            },
          ],
        }
      );

    // 13. Emit realtime event after successful commit.

    const io = req.app.get("io");

    if (io) {
      io.emit(
        "newAppointment",
        savedAppointment || appointment
      );
    }

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      data: formatAppointment(
        savedAppointment || appointment
      ),
    });

  } catch (error) {
    // Roll back only if transaction is still active.

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "[BeautyVibe] Rollback failed:",
          rollbackError
        );
      }
    }

    // Handle simultaneous duplicate requests.

    if (error instanceof UniqueConstraintError) {
      try {
        const existing =
          await Appointment.findOne({
            where: {
              requestId,
            },
          });

        if (
          existing &&
          Number(existing.userId) ===
            getAuthenticatedUserId(req)
        ) {
          return res.status(200).json({
            success: true,
            duplicateRequest: true,
            message: "Existing appointment recovered.",
            data: formatAppointment(existing),
          });
        }
      } catch (lookupError) {
        console.error(
          "[BeautyVibe] Duplicate lookup failed:",
          lookupError
        );
      }

      return sendError(
        res,
        409,
        "This booking request has already been processed."
      );
    }

    // Detailed server-side diagnostics.

    console.error(
      "========== BEAUTYVIBE BOOKING ERROR =========="
    );

    console.error("Name:", error.name);
    console.error("Message:", error.message);
    console.error("SQL code:", error.original?.code);
    console.error("SQL message:", error.original?.message);
    console.error("SQL:", error.sql);
    console.error("Constraint:", error.parent?.constraint);
    console.error("Table:", error.parent?.table);

    console.error(
      "=============================================="
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create appointment.",
      code: error.original?.code || error.name,
    });
  }
};

// ======================================================
// UPDATE APPOINTMENT STATUS
// ======================================================

exports.updateAppointmentStatus = async (
  req,
  res
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return sendError(
        res,
        401,
        "Authentication required."
      );
    }

    const allowedStatuses = [
      "Pending",
      "Confirmed",
      "Completed",
      "Cancelled",
      "In Progress",
    ];

    if (!allowedStatuses.includes(status)) {
      return sendError(
        res,
        400,
        "Invalid appointment status."
      );
    }

    const appointment =
      await Appointment.findByPk(id);

    if (!appointment) {
      return sendError(
        res,
        404,
        "Appointment not found."
      );
    }

    // Only admins can update appointment status.
    if (req.user?.role !== "admin") {
      return sendError(
        res,
        403,
        "Administrator access required."
      );
    }

    await appointment.update({
      status,
    });

    const io = req.app.get("io");

    if (io) {
      io.emit(
        "appointmentUpdated",
        appointment
      );
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully.",
      data: appointment,
    });

  } catch (error) {
    console.error(
      "[BeautyVibe] Update status failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to update appointment status.",
    });
  }
};

// ======================================================
// ASSIGN STAFF
// ======================================================

exports.assignStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedStaff } = req.body;

    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return sendError(
        res,
        401,
        "Authentication required."
      );
    }

    if (req.user?.role !== "admin") {
      return sendError(
        res,
        403,
        "Administrator access required."
      );
    }

    if (
      typeof assignedStaff !== "string" ||
      !assignedStaff.trim()
    ) {
      return sendError(
        res,
        400,
        "Valid staff name is required."
      );
    }

    const appointment =
      await Appointment.findByPk(id);

    if (!appointment) {
      return sendError(
        res,
        404,
        "Appointment not found."
      );
    }

    await appointment.update({
      assignedStaff: assignedStaff.trim(),
    });

    const io = req.app.get("io");

    if (io) {
      io.emit(
        "appointmentUpdated",
        appointment
      );
    }

    return res.status(200).json({
      success: true,
      message: "Expert assigned successfully.",
      data: appointment,
    });

  } catch (error) {
    console.error(
      "[BeautyVibe] Assign staff failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to assign staff.",
    });
  }
};
