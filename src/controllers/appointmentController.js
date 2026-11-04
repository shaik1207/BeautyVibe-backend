
const { Op, UniqueConstraintError } = require("sequelize");
const { randomUUID } = require("crypto");

const sequelize = require("../config/database");
const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
const User = require("../models/User");

// ============================================
// HELPERS
// ============================================

const sendError = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message,
  });
};

const getAuthenticatedUserId = (req) => {
  const id = Number(req.user?.id);

  return Number.isInteger(id) && id > 0 ? id : null;
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

  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const getRequestId = (req) => {
  const value =
    req.headers["idempotency-key"] ||
    req.body?.requestId;

  if (value === undefined || value === null || value === "") {
    return randomUUID();
  }

  const requestId = String(value).trim();

  if (requestId.length > 100) {
    return null;
  }

  return requestId;
};

// ============================================
// GET USER APPOINTMENTS
// ============================================

exports.getUserAppointments = async (req, res) => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return sendError(res, 401, "Authentication required.");
    }

    const isAdmin = req.user?.role === "admin";

    const appointments = await Appointment.findAll({
      where: isAdmin ? {} : { userId },

      include: [
        {
          model: Service,
          as: "service",
          attributes: ["id", "name", "category", "duration", "image"],
          required: false,
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email", "phone", "avatar"],
          required: false,
        },
      ],

      order: [["createdAt", "DESC"]],
    });

    const formatted = appointments.map((app) => {
      const plain = app.get({ plain: true });

      return {
        _id: plain.id,
        id: plain.id,

        serviceId: plain.serviceId,

        passCode: plain.passCode || `PASS-${plain.id}`,
        requestId: plain.requestId || `REQ-${plain.id}`,

        serviceName:
          plain.service?.name ||
          plain.serviceName ||
          "Beauty Ritual",

        category:
          plain.service?.category ||
          plain.category ||
          "General",

        amount: Number(plain.amount || 0),

        type: plain.type || "SALON",

        date: plain.date,
        time: plain.time,

        status: plain.status || "Pending",

        assignedStaff: plain.assignedStaff || "",

        user: plain.user
          ? {
              id: plain.user.id,
              name: plain.user.name,
              email: plain.user.email,
              phone: plain.user.phone,
              avatar: plain.user.avatar || "",
            }
          : {
              name: "Valued Client",
              avatar: "",
            },

        createdAt: plain.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error("[BeautyVibe] Get appointments error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve appointments.",
    });
  }
};

// ============================================
// GET BOOKED SLOTS
// ============================================

exports.getBookedSlots = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return sendError(
        res,
        400,
        "Date query parameter is required."
      );
    }

    const bookedAppointments = await Appointment.findAll({
      where: {
        date,
        status: {
          [Op.ne]: "Cancelled",
        },
      },

      attributes: ["time", "date"],
    });

    const bookedSlots = bookedAppointments.map(
      (appointment) => appointment.time
    );

    return res.status(200).json({
      success: true,
      data: bookedSlots,
    });
  } catch (error) {
    console.error("[BeautyVibe] Get booked slots error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve booked slots.",
    });
  }
};

// ============================================
// CREATE APPOINTMENT
// ============================================

exports.createAppointment = async (req, res) => {
  let transaction;

  try {
    // 1. Require authentication
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return sendError(
        res,
        401,
        "Authentication required. Please log in again."
      );
    }

    // 2. Validate required fields
    const {
      serviceId,
      serviceName,
      category,
      amount,
      type,
      date,
      time,
    } = req.body || {};

    if (!date || !time) {
      return sendError(
        res,
        400,
        "Please provide appointment date and time."
      );
    }

    // 3. Validate service ID
    const validServiceId = normalizeServiceId(serviceId);

    if (!validServiceId) {
      return sendError(
        res,
        400,
        "A valid service ID is required. Please select the service again."
      );
    }

    // 4. Validate idempotency key
    const requestId = getRequestId(req);

    if (!requestId) {
      return sendError(
        res,
        400,
        "Invalid booking request ID."
      );
    }

    // 5. Check whether this request was already processed
    const existingAppointment = await Appointment.findOne({
      where: { requestId },
    });

    if (existingAppointment) {
      if (Number(existingAppointment.userId) !== userId) {
        return sendError(
          res,
          409,
          "This booking request ID is already in use."
        );
      }

      return res.status(200).json({
        success: true,
        duplicateRequest: true,
        message: "Appointment already processed.",
        data: existingAppointment,
      });
    }

    // 6. Start database transaction
    transaction = await sequelize.transaction();

    // 7. Verify that service really exists
    const service = await Service.findByPk(validServiceId, {
      transaction,
      lock: transaction.LOCK.SHARE,
    });

    if (!service) {
      await transaction.rollback();
      transaction = null;

      return sendError(
        res,
        404,
        "Selected service was not found. Please refresh the services and try again."
      );
    }

    // 8. Verify user exists
    const user = await User.findByPk(userId, {
      transaction,
    });

    if (!user) {
      await transaction.rollback();
      transaction = null;

      return sendError(
        res,
        401,
        "Your account could not be verified. Please log in again."
      );
    }

    // 9. Use the service price from the database
    const databasePrice = Number(service.price);

    if (!Number.isFinite(databasePrice) || databasePrice < 0) {
      await transaction.rollback();
      transaction = null;

      return sendError(
        res,
        400,
        "The selected service has an invalid price."
      );
    }

    // NOTE:
    // If your booking system applies discounts or travel fees,
    // calculate those server-side here before creating the appointment.
    const finalAmount = databasePrice;

    const finalServiceName = service.name;
    const finalCategory = service.category || "General";

    const finalType =
      type === "HOME" || type === "SALON"
        ? type
        : "HOME";

    const passCode =
      `PASS-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

    // 10. Create appointment
    const appointment = await Appointment.create(
      {
        userId,

        serviceId: service.id,

        serviceName: finalServiceName,
        category: finalCategory,

        amount: finalAmount,

        type: finalType,

        date: String(date).trim(),
        time: String(time).trim(),

        status: "Pending",

        passCode,
        requestId,
      },
      {
        transaction,
      }
    );

    // 11. Commit transaction
    await transaction.commit();
    transaction = null;

    // 12. Emit event only after successful database commit
    const io = req.app.get("io");

    if (io) {
      io.emit("newAppointment", appointment);
    }

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      data: appointment,
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "[BeautyVibe] Transaction rollback error:",
          rollbackError
        );
      }
    }

    // Handle simultaneous duplicate requests
    if (error instanceof UniqueConstraintError) {
      try {
        const requestId = getRequestId(req);

        const existing = requestId
          ? await Appointment.findOne({
              where: { requestId },
            })
          : null;

        if (
          existing &&
          Number(existing.userId) === getAuthenticatedUserId(req)
        ) {
          return res.status(200).json({
            success: true,
            duplicateRequest: true,
            message: "Appointment already processed.",
            data: existing,
          });
        }
      } catch (lookupError) {
        console.error(
          "[BeautyVibe] Duplicate lookup error:",
          lookupError
        );
      }

      return sendError(
        res,
        409,
        "This booking request has already been processed."
      );
    }

    console.error(
      "[BeautyVibe] Create appointment error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create appointment.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

// ============================================
// UPDATE APPOINTMENT STATUS
// ============================================

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "Pending",
      "Confirmed",
      "Completed",
      "Cancelled",
      "In Progress",
    ];

    if (!allowedStatuses.includes(status)) {
      return sendError(res, 400, "Invalid appointment status.");
    }

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return sendError(res, 404, "Appointment not found.");
    }

    await appointment.update({ status });

    const io = req.app.get("io");

    if (io) {
      io.emit("appointmentUpdated", appointment);
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully.",
      data: appointment,
    });
  } catch (error) {
    console.error("[BeautyVibe] Update status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update appointment status.",
    });
  }
};

// ============================================
// ASSIGN STAFF
// ============================================

exports.assignStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedStaff } = req.body;

    if (
      assignedStaff === undefined ||
      assignedStaff === null ||
      typeof assignedStaff !== "string"
    ) {
      return sendError(res, 400, "Valid staff name is required.");
    }

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      return sendError(res, 404, "Appointment not found.");
    }

    await appointment.update({
      assignedStaff: assignedStaff.trim(),
    });

    const io = req.app.get("io");

    if (io) {
      io.emit("appointmentUpdated", appointment);
    }

    return res.status(200).json({
      success: true,
      message: "Expert assigned successfully.",
      data: appointment,
    });
  } catch (error) {
    console.error("[BeautyVibe] Assign staff error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to assign staff.",
    });
  }
};
