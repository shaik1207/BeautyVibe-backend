const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const User = require('../models/User');
const { Op } = require('sequelize');

exports.getUserAppointments = async (req, res) => {
  try {
    const userId = req.user?.dbId || req.user?.id;
    const isAdmin = req.user?.role === 'admin';
    const queryOptions = isAdmin ? {} : (userId ? { where: { userId } } : {});

    queryOptions.include = [
      { model: Service, as: 'service', attributes: ['name', 'category', 'duration', 'image'], required: false },
      { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'avatar'], required: false }
    ];
    queryOptions.order = [['createdAt', 'DESC']];

    const appointments = await Appointment.findAll(queryOptions);

    const formatted = appointments.map(app => {
      const plain = app.get({ plain: true });
      const dbUser = plain.user || {};

      // 1. Resolve Name securely
      let resolvedName = plain.customerName || dbUser.name || 'Valued Client';
      if (!resolvedName || resolvedName.trim() === '' || resolvedName.includes('undefined')) {
        resolvedName = 'Valued Client';
      }

      // 2. Resolve Mobile securely and strip out any dummy caching
      let resolvedMobile = plain.mobileNumber || plain.phone || dbUser.phone || '';
      if (resolvedMobile.includes('98765') || resolvedMobile.includes('dummy') || resolvedMobile === '+91 98765 43210') {
        resolvedMobile = '';
      }

      return {
        _id: plain.id,
        id: plain.id,
        passCode: plain.passCode || `PASS-${plain.id}`,
        requestId: plain.requestId || `REQ-${plain.id}`,
        serviceName: plain.service?.name || plain.serviceName || 'Beauty Ritual',
        category: plain.service?.category || plain.category || 'General',
        amount: plain.amount || 999,
        type: plain.type || 'HOME',
        date: plain.date,
        time: plain.time,
        status: plain.status || 'Pending',
        assignedStaff: plain.assignedStaff || '',
        customerName: resolvedName,
        mobileNumber: resolvedMobile,
        address: plain.address || dbUser.address || '',
        user: {
          name: resolvedName,
          email: dbUser.email || 'client@beautyvibe.in',
          mobile: resolvedMobile,
          avatar: dbUser.avatar || ''
        },
        createdAt: plain.createdAt
      };
    });

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Get Appointments Error:", error);
    return res.status(200).json({ success: true, data: [] });
  }
};

exports.getBookedSlots = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(200).json({ success: true, data: [] });
    }

    const bookedAppointments = await Appointment.findAll({
      where: { date, status: { [Op.ne]: 'Cancelled' } },
      attributes: ['time', 'date']
    });

    const bookedSlots = bookedAppointments.map(app => app.time);
    return res.status(200).json({ success: true, data: bookedSlots });
  } catch (error) {
    console.error("Get Booked Slots Error:", error);
    return res.status(200).json({ success: true, data: [] });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.requestId;

    if (idempotencyKey) {
      const existingRequest = await Appointment.findOne({ where: { requestId: idempotencyKey } });
      if (existingRequest) {
        return res.status(200).json({
          success: true,
          duplicateRequest: true,
          message: 'Appointment already processed.',
          data: existingRequest
        });
      }
    }

    // --- CRITICAL FIX: AGGRESSIVE PAYLOAD EXTRACTION ---
    // Forms frequently nest data. We inspect all possible locations for user input.
    const custData = req.body.customerDetails || req.body.customer || req.body.user || req.body.client || {};

    const extractedFirstName = req.body.firstName || custData.firstName || '';
    const extractedLastName = req.body.lastName || custData.lastName || '';
    const extractedFullName = req.body.customerName || req.body.name || custData.name || custData.fullName || '';

    // Build the final customer name from first and last name if provided
    let finalCustomerName = extractedFullName || `${extractedFirstName} ${extractedLastName}`.trim();
    if (!finalCustomerName || finalCustomerName === '' || finalCustomerName === 'undefined undefined') {
      finalCustomerName = 'Valued Client';
    }

    // Extract exact mobile number from form. NEVER fallback to admin's dummy session phone.
    const finalMobile = (
      req.body.mobileNumber || 
      custData.mobileNumber || 
      req.body.phone || 
      custData.phone || 
      req.body.phoneNumber || 
      custData.mobile || 
      ''
    ).toString().trim();

    const finalAddress = (
      req.body.address || 
      req.body.doorstepAddress || 
      (typeof req.body.location === 'string' ? req.body.location : req.body.location?.fullAddress) || 
      custData.address ||
      ''
    ).trim();
    // ---------------------------------------------------

    const { serviceId, serviceName, category, amount, type, date, time, requestId } = req.body;

    if (!date || !time) {
      return res.status(400).json({ success: false, message: 'Please provide appointment date and time.' });
    }

    const finalServiceName = serviceName || 'Beauty Ritual';
    const finalCategory = category || 'General';
    const finalAmount = Number(amount) || 999;
    const passCode = `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const mysqlUserId = req.user?.dbId || req.user?.id || null;

    let validServiceId = null;
    try {
      const rawServiceId = Number(serviceId);
      if (!isNaN(rawServiceId) && rawServiceId > 0) {
        const found = await Service.findByPk(rawServiceId);
        if (found) validServiceId = found.id;
      }
      if (!validServiceId) {
        const [matchedService] = await Service.findOrCreate({
          where: { name: finalServiceName },
          defaults: { category: finalCategory, amount: finalAmount, duration: '30 mins' }
        });
        if (matchedService) validServiceId = matchedService.id;
      }
    } catch (srvErr) {
      console.warn("Service lookup warning:", srvErr.message);
    }

    // Save with the aggressively extracted data
    const appointmentData = {
      userId: mysqlUserId,
      serviceId: validServiceId || null, 
      serviceName: finalServiceName,
      category: finalCategory,
      amount: finalAmount,
      type: type || 'HOME',
      date,
      time,
      status: 'Pending',
      customerName: finalCustomerName,   // <-- Real Name
      mobileNumber: finalMobile,         // <-- Real Number
      phone: finalMobile,                // <-- Real Number
      address: finalAddress,
      passCode,
      requestId: requestId || idempotencyKey || `REQ-${Date.now()}`,
    };

    let appointment;
    try {
      appointment = await Appointment.create(appointmentData);
    } catch (dbErr) {
      appointmentData.serviceId = null;
      appointment = await Appointment.create(appointmentData);
    }

    const fullAppointment = await Appointment.findByPk(appointment.id, {
      include: [
        { model: Service, as: 'service', attributes: ['name', 'category', 'duration', 'image'], required: false },
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'avatar'], required: false }
      ]
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('newAppointment', fullAppointment || appointment);
    }

    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully.',
      data: fullAppointment || appointment
    });
  } catch (error) {
    console.error("Create Appointment Critical Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Unable to create appointment.', 
      code: error.code || 'INTERNAL_ERROR'
    });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Service, as: 'service', attributes: ['name', 'category', 'duration', 'image'], required: false },
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'avatar'], required: false }
      ]
    });

    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });

    appointment.status = status || appointment.status;
    await appointment.save();

    const io = req.app.get('io');
    if (io) io.emit('appointmentUpdated', appointment);

    return res.status(200).json({ success: true, message: 'Status updated successfully.', data: appointment });
  } catch (error) {
    console.error("Update Status Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignStaff = async (req, res) => {
  try {
    const { id: appId } = req.params;
    const { assignedStaff } = req.body;

    const appointment = await Appointment.findByPk(appId, {
      include: [
        { model: Service, as: 'service', attributes: ['name', 'category', 'duration', 'image'], required: false },
        { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'avatar'], required: false }
      ]
    });

    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });

    appointment.assignedStaff = assignedStaff;
    await appointment.save();

    const io = req.app.get('io');
    if (io) io.emit('appointmentUpdated', appointment);

    return res.status(200).json({ success: true, message: 'Expert assigned successfully.', data: appointment });
  } catch (error) {
    console.error("Assign Staff Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};