const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
const User = require("../models/User");
const { Op, UniqueConstraintError } = require("sequelize");
const { randomUUID } = require("crypto");

// ============================================
// STRICT UTILITIES & HELPERS
// ============================================

const cleanValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string" && typeof value !== "number") return "";

  const result = String(value).trim();
  if (!result) return "";

  const lower = result.toLowerCase();

  // ONLY Destroy exact and combined undefined/null strings
  if (/^(null|undefined|n\/a|na|undefined undefined|null null)$/.test(lower)) {
    return "";
  }

  // NOTE: Removed aggressive scrubbing against test data like "dummy" or "9876543210"

  return result;
};

const firstRealValue = (...values) => {
  for (const value of values) {
    const result = cleanValue(value);
    if (result) return result;
  }
  return "";
};

const resolveAddress = (value) => {
  if (!value) return "";
  if (typeof value === "string") return cleanValue(value);
  if (Array.isArray(value)) return value.map(resolveAddress).filter(Boolean).join(", ");
  if (typeof value !== "object") return "";

  const directAddress = firstRealValue(
    value.fullAddress,
    value.formattedAddress,
    value.address,
    value.location
  );
  if (directAddress) return directAddress;

  return [
    value.houseNo, value.flatNumber, value.building, value.apartment,
    value.street, value.area, value.landmark, value.city,
    value.district, value.state, value.postalCode, value.pincode,
  ].map(cleanValue).filter(Boolean).join(", ");
};

const resolveUserAddress = (user) => {
  if (!user) return "";
  const addresses = user.addresses;

  if (Array.isArray(addresses)) {
    const selected = addresses.find(
      (a) => a?.isDefault === true || a?.default === true || a?.isDefault === 1
    ) || addresses[0];
    return resolveAddress(selected);
  }

  if (addresses && typeof addresses === "object") {
    return resolveAddress(addresses.defaultAddress || addresses.selectedAddress || addresses);
  }

  return resolveAddress(user.address);
};

const getCustomerDetails = (body = {}) => {
  const customer = body.customerDetails || body.customer || body.user || body.client || {};

  const firstName = firstRealValue(body.firstName, customer.firstName);
  const lastName = firstRealValue(body.lastName, customer.lastName);
  const combinedName = [firstName, lastName].filter(Boolean).join(" ");

  const customerName = firstRealValue(
    body.customerName,
    body.name,
    customer.customerName,
    customer.fullName,
    customer.name,
    combinedName
  ) || "Valued Client";

  const mobileNumber = firstRealValue(
    body.mobileNumber,
    body.phoneNumber,
    body.phone,
    body.mobile,
    customer.mobileNumber,
    customer.phoneNumber,
    customer.phone,
    customer.mobile
  );

  const address = firstRealValue(
    body.address,
    body.doorstepAddress,
    body.fullAddress,
    typeof body.location === "string" ? body.location : body.location?.fullAddress,
    customer.address,
    customer.fullAddress
  );

  return { customerName, mobileNumber, address };
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
    attributes: ["id", "firstName", "lastName", "name", "email", "phone", "avatar", "addresses"],
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

      const profileName = [cleanValue(user.firstName), cleanValue(user.lastName)].filter(Boolean).join(" ");

      const customerName = firstRealValue(plain.customerName, profileName, user.name) || "Valued Client";
      const mobileNumber = firstRealValue(plain.mobileNumber, plain.phone, user.phone);
      const address = firstRealValue(resolveAddress(plain.address), resolveAddress(plain.doorstepAddress), resolveUserAddress(user));

      return {
        ...plain,
        _id: plain.id,
        id: plain.id,
        customerName,
        mobileNumber,
        phone: mobileNumber,
        address,
        serviceName: firstRealValue(plain.service?.name, plain.serviceName) || "Beauty Ritual",
        category: firstRealValue(plain.service?.category, plain.category) || "General",
        amount: Number(plain.amount || 0),
        passCode: plain.passCode || `PASS-${plain.id}`,
        requestId: plain.requestId || `REQ-${plain.id}`,
        status: plain.status || "Pending",
        assignedStaff: plain.assignedStaff || "",
        user: {
          id: user.id || plain.userId || null,
          firstName: cleanValue(user.firstName),
          lastName: cleanValue(user.lastName),
          name: customerName,
          email: cleanValue(user.email),
          phone: mobileNumber,
          mobile: mobileNumber,
          avatar: cleanValue(user.avatar),
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
    return res.status(500).json({ success: false, message: "Unable to retrieve appointments." });
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
    const idempotencyKey = cleanValue(req.headers["idempotency-key"] || body.requestId);

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

    const customerDetails = getCustomerDetails(body);
    const mysqlUserId = Number(req.user?.dbId || req.user?.id) || null;
    let linkedUser = null;

    if (mysqlUserId) {
      linkedUser = await User.findByPk(mysqlUserId);
    }

    const finalCustomerName = firstRealValue(customerDetails.customerName, linkedUser?.name) || "Valued Client";
    const finalMobile = firstRealValue(customerDetails.mobileNumber, linkedUser?.phone);
    const finalAddress = firstRealValue(customerDetails.address);
    
    const { date, time } = body;
    if (!date || !time) {
      return res.status(400).json({ success: false, message: "Please provide appointment date and time." });
    }

    const serviceId = Number(body.serviceId);
    let service = null;
    if (Number.isInteger(serviceId) && serviceId > 0) {
      service = await Service.findByPk(serviceId);
    }

    const finalServiceName = cleanValue(service?.name || body.serviceName) || "Beauty Ritual";
    const finalCategory = cleanValue(service?.category || body.category) || "General";
    const finalAmount = Number(service ? service.price : body.amount) || 999;
    const finalType = cleanValue(body.type).toUpperCase() === "SALON" ? "SALON" : "HOME";

    const appointmentData = {
      userId: mysqlUserId,
      serviceId: service?.id || null,
      customerName: finalCustomerName,
      mobileNumber: finalMobile,
      phone: finalMobile,
      address: finalAddress,
      serviceName: finalServiceName,
      category: finalCategory,
      amount: finalAmount,
      type: finalType,
      date: cleanValue(date),
      time: cleanValue(time),
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
    return res.status(500).json({ success: false, message: "Unable to create appointment." });
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
    const assignedStaff = cleanValue(req.body?.assignedStaff);

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