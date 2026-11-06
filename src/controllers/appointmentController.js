const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
const User = require("../models/User");
const { Op, UniqueConstraintError } = require("sequelize");
const { randomUUID } = require("crypto");

const cleanString = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string" && typeof value !== "number") return "";

  const result = String(value).trim();
  if (!result) return "";

  const lower = result.toLowerCase();
  if (/^(null|undefined|n\/a|na|undefined undefined|null null|valued client|walk-in client)$/.test(lower)) {
    return "";
  }

  // Reject email addresses from being treated as names or phones
  if (result.includes("@") && result.includes(".")) {
    return "";
  }

  return result;
};

const firstRealValue = (...values) => {
  for (const value of values) {
    const result = cleanString(value);
    if (result) return result;
  }
  return "";
};

const resolveAddress = (value) => {
  if (!value) return "";
  if (typeof value === "string") return cleanString(value);
  if (Array.isArray(value)) return value.map(resolveAddress).filter(Boolean).join(", ");
  if (typeof value !== "object") return "";

  return [
    value.houseNo,
    value.flatNumber,
    value.building,
    value.apartment,
    value.street,
    value.area,
    value.landmark,
    value.city,
    value.district,
    value.state,
    value.postalCode,
    value.pincode,
  ]
    .map(cleanString)
    .filter(Boolean)
    .join(", ");
};

const resolveUserAddress = (user) => {
  if (!user) return "";
  const addresses = user.addresses;

  if (Array.isArray(addresses)) {
    const selected =
      addresses.find(
        (a) => a?.isDefault === true || a?.default === true || a?.isDefault === 1
      ) || addresses[0];
    return resolveAddress(selected);
  }

  if (addresses && typeof addresses === "object") {
    return resolveAddress(addresses.defaultAddress || addresses.selectedAddress || addresses);
  }

  return resolveAddress(user.address);
};

const extractCustomerInfo = (body = {}, linkedUser = null) => {
  const customer = body.customerDetails || body.customer || body.user || body.client || {};

  const firstName = firstRealValue(
    body.firstName,
    customer.firstName,
    body.first_name,
    linkedUser?.firstName
  );

  const lastName = firstRealValue(
    body.lastName,
    customer.lastName,
    body.last_name,
    linkedUser?.lastName
  );

  const combinedFirstLast = [firstName, lastName].filter(Boolean).join(" ");

  const rawCandidateName = firstRealValue(
    combinedFirstLast,
    body.customerName,
    body.fullName,
    body.name,
    customer.customerName,
    customer.fullName,
    customer.name,
    linkedUser?.name
  );

  const customerName = cleanString(rawCandidateName) || "Valued Client";

  // Comprehensive fallback for mobile numbers across all payloads
  const mobileNumber = firstRealValue(
    body.mobileNumber,
    body.phoneNumber,
    body.phone,
    body.mobile,
    body.contact,
    body.customerPhone,
    customer.mobileNumber,
    customer.phoneNumber,
    customer.phone,
    customer.mobile,
    customer.contact,
    customer.customerPhone,
    linkedUser?.phone,
    linkedUser?.mobileNumber,
    linkedUser?.mobile
  );

  const address = firstRealValue(
    resolveAddress(body.address),
    resolveAddress(body.doorstepAddress),
    resolveAddress(body.serviceAddress),
    resolveAddress(body.customerAddress),
    resolveAddress(body.fullAddress),
    resolveAddress(body.location),
    resolveAddress(customer.address),
    resolveUserAddress(linkedUser)
  );

  return { firstName, lastName, customerName, mobileNumber, address };
};

const appointmentIncludes = () => [
  {
    model: Service,
    as: "service",
    attributes: ["id", "name", "category", "duration", "image", "price"],
    required: false,
  },
  {
    model: User,
    as: "user",
    attributes: ["id", "firstName", "lastName", "name", "email", "phone", "mobile", "mobileNumber", "avatar", "addresses"],
    required: false,
  },
];

// ============================================
// GET USER APPOINTMENTS
// ============================================
exports.getUserAppointments = async (req, res) => {
  try {
    const userId = Number(req.user?.dbId || req.user?.id);
    const role = String(req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin" || role === "superadmin";

    if (!isAdmin && (!Number.isInteger(userId) || userId <= 0)) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const appointments = await Appointment.findAll({
      where: isAdmin ? {} : { userId },
      include: appointmentIncludes(),
      order: [["createdAt", "DESC"]],
    });

    const formattedAppointments = appointments.map((appointment) => {
      const plain = appointment.get({ plain: true });
      const user = plain.user || {};
      const info = extractCustomerInfo(plain, user);

      return {
        ...plain,
        _id: plain.id,
        id: plain.id,
        firstName: info.firstName,
        lastName: info.lastName,
        customerName: info.customerName,
        name: info.customerName,
        fullName: info.customerName,
        mobileNumber: info.mobileNumber,
        phone: info.mobileNumber,
        phoneNumber: info.mobileNumber,
        mobile: info.mobileNumber,
        address: info.address,
        doorstepAddress: info.address,
        serviceName: firstRealValue(plain.service?.name, plain.serviceName) || "Beauty Ritual",
        category: firstRealValue(plain.service?.category, plain.category) || "General",
        amount: Number(plain.amount || 0),
        passCode: plain.passCode || `PASS-${plain.id}`,
        requestId: plain.requestId || `REQ-${plain.id}`,
        status: plain.status || "Pending",
        assignedStaff: plain.assignedStaff || "",
        user: {
          id: user.id || plain.userId || null,
          firstName: info.firstName,
          lastName: info.lastName,
          name: info.customerName,
          email: cleanString(user.email),
          phone: info.mobileNumber,
          mobile: info.mobileNumber,
          avatar: cleanString(user.avatar),
          addresses: user.addresses || [],
        },
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedAppointments.length,
      data: formattedAppointments,
    });
  } catch (error) {
    console.error("[BeautyVibe] Get appointments error:", error);
    return res.status(500).json({ success: false, message: error.message || "Unable to retrieve appointments." });
  }
};

// ============================================
// GET BOOKED SLOTS
// ============================================
exports.getBookedSlots = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: "Appointment date is required." });

    const bookedAppointments = await Appointment.findAll({
      where: { date, status: { [Op.notIn]: ["Cancelled", "Rejected"] } },
      attributes: ["time", "date"],
    });

    const bookedSlots = bookedAppointments.map((app) => app.time);
    return res.status(200).json({ success: true, data: bookedSlots });
  } catch (error) {
    console.error("[BeautyVibe] Get booked slots error:", error);
    return res.status(500).json({ success: false, message: "Unable to retrieve booked slots." });
  }
};

// ============================================
// CREATE APPOINTMENT
// ============================================
exports.createAppointment = async (req, res) => {
  try {
    const body = req.body || {};
    const idempotencyKey = cleanString(req.headers["idempotency-key"] || body.requestId);

    if (idempotencyKey) {
      const existingAppointment = await Appointment.findOne({
        where: { requestId: idempotencyKey },
        include: appointmentIncludes(),
      });
      if (existingAppointment) {
        return res.status(200).json({
          success: true,
          duplicateRequest: true,
          message: "Appointment already processed.",
          data: existingAppointment,
        });
      }
    }

    const mysqlUserId = Number(req.user?.dbId || req.user?.id) || null;
    let linkedUser = null;
    if (mysqlUserId) {
      linkedUser = await User.findByPk(mysqlUserId);
    }

    const info = extractCustomerInfo(body, linkedUser);

    const { date, time } = body;
    if (!date || !time) {
      return res.status(400).json({ success: false, message: "Please provide appointment date and time." });
    }

    const serviceId = Number(body.serviceId);
    let service = null;
    if (Number.isInteger(serviceId) && serviceId > 0) {
      service = await Service.findByPk(serviceId);
    }

    const finalServiceName = cleanString(service?.name || body.serviceName) || "Beauty Ritual";
    const finalCategory = cleanString(service?.category || body.category) || "General";
    const finalAmount = Number(service ? service.price : body.amount) || 999;
    const finalType = cleanString(body.type).toUpperCase() === "SALON" ? "SALON" : "HOME";

    const appointmentData = {
      userId: mysqlUserId,
      serviceId: service?.id || null,
      firstName: info.firstName,
      lastName: info.lastName,
      customerName: info.customerName,
      mobileNumber: info.mobileNumber,
      phone: info.mobileNumber,
      address: info.address,
      serviceName: finalServiceName,
      category: finalCategory,
      amount: finalAmount,
      type: finalType,
      date: cleanString(date),
      time: cleanString(time),
      status: "Pending",
      requestId: idempotencyKey || randomUUID(),
      passCode: `PASS-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    };

    const appointment = await Appointment.create(appointmentData);
    const fullAppointment = await Appointment.findByPk(appointment.id, {
      include: appointmentIncludes(),
    });

    const responseAppointment = fullAppointment || appointment;
    const io = req.app.get("io");
    if (io) io.emit("newAppointment", responseAppointment);

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully.",
      data: responseAppointment,
    });
  } catch (error) {
    console.error("[BeautyVibe] Create appointment error:", error);
    if (error instanceof UniqueConstraintError) {
      return res.status(409).json({ success: false, message: "Booking request already processed." });
    }
    return res.status(500).json({ success: false, message: error.message || "Unable to create appointment." });
  }
};

// ============================================
// UPDATE APPOINTMENT STATUS
// ============================================
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const allowedStatuses = ["Pending", "Accepted", "Completed", "Rejected", "Cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid appointment status." });
    }

    const appointment = await Appointment.findByPk(id);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found." });

    appointment.status = status;
    await appointment.save();

    const updatedAppointment = await Appointment.findByPk(id, { include: appointmentIncludes() });
    const io = req.app.get("io");
    if (io) io.emit("appointmentUpdated", updatedAppointment || appointment);

    return res.status(200).json({
      success: true,
      message: "Appointment status updated successfully.",
      data: updatedAppointment || appointment,
    });
  } catch (error) {
    console.error("[BeautyVibe] Update status error:", error);
    return res.status(500).json({ success: false, message: "Unable to update status." });
  }
};

// ============================================
// ASSIGN STAFF
// ============================================
exports.assignStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const assignedStaff = cleanString(req.body?.assignedStaff);

    if (!assignedStaff) return res.status(400).json({ success: false, message: "Please select a staff member." });

    const appointment = await Appointment.findByPk(id);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found." });

    appointment.assignedStaff = assignedStaff;
    await appointment.save();

    const updatedAppointment = await Appointment.findByPk(id, { include: appointmentIncludes() });
    const io = req.app.get("io");
    if (io) io.emit("appointmentUpdated", updatedAppointment || appointment);

    return res.status(200).json({
      success: true,
      message: "Staff assigned successfully.",
      data: updatedAppointment || appointment,
    });
  } catch (error) {
    console.error("[BeautyVibe] Assign staff error:", error);
    return res.status(500).json({ success: false, message: "Unable to assign staff." });
  }
};