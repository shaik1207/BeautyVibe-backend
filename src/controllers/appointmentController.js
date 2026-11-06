// controllers/appointmentController.js
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

      // Robust fallback resolution for real customer mobile number
      const resolvedMobile = 
        plain.mobileNumber || 
        plain.phone || 
        dbUser.phone || 
        req.user?.phone || 
        req.user?.mobile || 
        '';

      const resolvedName = 
        plain.customerName || 
        dbUser.name || 
        req.user?.name || 
        'Valued Client';

      const resolvedAddress = 
        plain.address || 
        dbUser.address || 
        '';

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
        address: resolvedAddress,
        user: {
          name: resolvedName,
          email: dbUser.email || req.user?.email || 'client@beautyvibe.in',
          mobile: resolvedMobile,
          avatar: dbUser.avatar || req.user?.avatar || ''
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

    // Inspect nested objects where frontend forms frequently store user details
    const bodyCust = req.body.customer || req.body.customerDetails || req.body.user || req.body.client || {};

    const { 
      serviceId, serviceName, category, amount, type, date, time, requestId,
      address, doorstepAddress, customerName, name, firstName, lastName, fullName
    } = req.body;

    if (!date || !time) {
      return res.status(400).json({ success: false, message: 'Please provide appointment date and time.' });
    }

    const finalServiceName = serviceName || 'Beauty Ritual';
    const finalCategory = category || 'General';
    const finalAmount = Number(amount) || 999;
    
    // Exhaustive check across flat keys, nested customer objects, and session user
    const finalMobile = (
      req.body.mobileNumber || 
      req.body.phone || 
      req.body.phoneNumber || 
      req.body.mobile || 
      req.body.phone_number || 
      req.body.number || 
      req.body.contact || 
      req.body.contactNumber || 
      req.body.telephone || 
      req.body.clientPhone ||
      req.body.customerPhone ||
      req.body.userPhone ||
      bodyCust.mobileNumber ||
      bodyCust.phone ||
      bodyCust.phoneNumber ||
      bodyCust.mobile ||
      bodyCust.contact ||
      req.user?.phone || 
      req.user?.mobile || 
      req.user?.phoneNumber || 
      ''
    ).trim();

    const finalAddress = (
      address || 
      doorstepAddress || 
      (typeof req.body.location === 'string' ? req.body.location : req.body.location?.fullAddress) || 
      req.user?.address || 
      ''
    ).trim();

    const derivedName = [firstName, lastName].filter(Boolean).join(' ');
    const finalCustomerName = (
      customerName || 
      name || 
      fullName || 
      derivedName || 
      bodyCust.name ||
      bodyCust.fullName ||
      req.user?.name || 
      req.user?.displayName || 
      'Valued Client'
    ).trim();

    // Resolve User ID and update user phone if missing
    let mysqlUserId = null;
    try {
      if (req.user && (req.user.email || req.user.id)) {
        const email = req.user.email || `user_${req.user.id || Date.now()}@beautyvibe.in`;
        const userName = req.user.name || req.user.displayName || finalCustomerName;
        
        const [userRecord] = await User.findOrCreate({
          where: { email },
          defaults: { 
            name: userName, 
            role: req.user.role || 'client',
            phone: finalMobile || req.user?.phone || ''
          }
        });

        if (userRecord) {
          mysqlUserId = userRecord.id;
          if (finalMobile && !userRecord.phone) {
            userRecord.phone = finalMobile;
            await userRecord.save();
          }
        }
      }
    } catch (userErr) {
      console.warn("User resolution warning:", userErr.message);
    }

    if (!mysqlUserId) {
      try {
        const [guestUser] = await User.findOrCreate({
          where: { email: 'guest@beautyvibe.in' },
          defaults: { name: 'Valued Guest', role: 'client', phone: finalMobile }
        });
        if (guestUser) {
          mysqlUserId = guestUser.id;
          if (finalMobile && !guestUser.phone) {
            guestUser.phone = finalMobile;
            await guestUser.save();
          }
        }
      } catch (e) {
        mysqlUserId = null;
      }
    }

    // Resolve Service ID
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

    const passCode = `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create appointment and save mobile number in both columns
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
      customerName: finalCustomerName,
      mobileNumber: finalMobile,
      phone: finalMobile,
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

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

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

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

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