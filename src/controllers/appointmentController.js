const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const User = require('../models/User');
const { Op } = require('sequelize');

exports.getUserAppointments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userId = req.user.dbId || req.user.id;
    const isAdmin = req.user.role === 'admin';
    const queryOptions = isAdmin ? {} : { where: { userId } };

    queryOptions.include = [
      { model: Service, as: 'service', attributes: ['name', 'category', 'duration', 'image'], required: false },
      { model: User, as: 'user', attributes: ['name', 'email', 'phone', 'avatar'], required: false }
    ];
    queryOptions.order = [['createdAt', 'DESC']];

    const appointments = await Appointment.findAll(queryOptions);

    const formatted = appointments.map(app => {
      const plain = app.get({ plain: true });
      return {
        _id: plain.id,
        id: plain.id,
        passCode: plain.passCode || `PASS-${plain.id}`,
        requestId: plain.requestId || `REQ-${plain.id}`,
        serviceName: plain.service?.name || plain.serviceName || 'Beauty Ritual',
        category: plain.service?.category || plain.category || 'General',
        amount: plain.amount || 999,
        type: plain.type || 'SALON',
        date: plain.date,
        time: plain.time,
        status: plain.status || 'Pending',
        assignedStaff: plain.assignedStaff || '',
        user: plain.user ? {
          name: plain.user.name,
          email: plain.user.email,
          avatar: plain.user.avatar || ''
        } : { name: 'Valued Client', avatar: '' },
        createdAt: plain.createdAt
      };
    });

    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("Get Appointments Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBookedSlots = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date query parameter is required.' });
    }

    const bookedAppointments = await Appointment.findAll({
      where: { date, status: { [Op.ne]: 'Cancelled' } },
      attributes: ['time', 'date']
    });

    const bookedSlots = bookedAppointments.map(app => app.time);
    return res.status(200).json({ success: true, data: bookedSlots });
  } catch (error) {
    console.error("Get Booked Slots Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.requestId;

    // Database-level idempotency check (survives Render restarts)
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

    let { serviceId, serviceName, category, amount, type, date, time, requestId } = req.body;

    if (!date || !time) {
      return res.status(400).json({ success: false, message: 'Please provide appointment date and time.' });
    }

    const finalServiceName = serviceName || 'Beauty Ritual';
    const finalCategory = category || 'General';
    const finalAmount = amount || 999;

    // =========================================================================
    // 1. GUARANTEE A VALID USER ID IN MYSQL
    // =========================================================================
    let mysqlUserId = null;
    if (req.user && (req.user.email || req.user.id)) {
      const email = req.user.email || `user_${req.user.id || Date.now()}@beautyvibe.in`;
      const name = req.user.name || req.user.displayName || 'Valued Client';
      
      const [userRecord] = await User.findOrCreate({
        where: { email },
        defaults: { name, role: req.user.role || 'client' }
      });
      mysqlUserId = userRecord.id;
    }

    if (!mysqlUserId) {
      const [guestUser] = await User.findOrCreate({
        where: { email: 'guest@beautyvibe.in' },
        defaults: { name: 'Valued Guest', role: 'client' }
      });
      mysqlUserId = guestUser.id;
    }

    // =========================================================================
    // 2. INFALLIBLE SERVICE ID RESOLUTION (Guarantees foreign key never fails)
    // =========================================================================
    let validServiceId = null;

    // Tier A: Try looking up by incoming serviceId
    if (serviceId !== undefined && serviceId !== null && !isNaN(Number(serviceId))) {
      const foundService = await Service.findByPk(Number(serviceId));
      if (foundService) {
        validServiceId = foundService.id;
      }
    }

    // Tier B: If not found, find or create by service name
    if (!validServiceId) {
      try {
        const [matchedService] = await Service.findOrCreate({
          where: { name: finalServiceName },
          defaults: {
            category: finalCategory,
            amount: finalAmount,
            duration: '30 mins'
          }
        });
        if (matchedService && matchedService.id) {
          validServiceId = matchedService.id;
        }
      } catch (e) {
        console.warn("[Appointment] findOrCreate by name failed:", e.message);
      }
    }

    // Tier C: Grab any existing service in the database table
    if (!validServiceId) {
      const anyService = await Service.findOne();
      if (anyService) {
        validServiceId = anyService.id;
      }
    }

    // Tier D: Absolute last resort emergency creation
    if (!validServiceId) {
      const defaultService = await Service.create({
        name: finalServiceName || 'Beauty Ritual',
        category: finalCategory,
        amount: finalAmount,
        duration: '30 mins'
      });
      validServiceId = defaultService.id;
    }

    // FINAL DATABASE VERIFICATION: Prove the ID exists in the Services table right now
    const verifyService = await Service.findByPk(validServiceId);
    if (!verifyService) {
      const emergencyService = await Service.create({
        name: finalServiceName || 'Emergency Service',
        category: finalCategory,
        amount: finalAmount,
        duration: '30 mins'
      });
      validServiceId = emergencyService.id;
    }

    const passCode = `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // =========================================================================
    // 3. CREATE APPOINTMENT RECORD
    // =========================================================================
    const appointmentData = {
      userId: mysqlUserId,
      serviceId: validServiceId, // Guaranteed valid primary key in Services table
      serviceName: finalServiceName,
      category: finalCategory,
      amount: finalAmount,
      type: type || 'HOME',
      date,
      time,
      status: 'Pending',
      passCode,
      requestId: requestId || idempotencyKey || `REQ-${Date.now()}`,
    };

    const appointment = await Appointment.create(appointmentData);

    const io = req.app.get('io');
    if (io) {
      io.emit('newAppointment', appointment);
    }

    return res.status(201).json({
      success: true,
      message: 'Appointment booked successfully.',
      data: appointment
    });
  } catch (error) {
    console.error("Create Appointment Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Unable to create appointment.', 
      code: error.original?.code || error.parent?.code || error.code || 'INTERNAL_ERROR',
      sqlError: error.original?.sqlMessage || error.parent?.message || error.message 
    });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const appointment = await Appointment.findByPk(id);
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
    const { id } = req.params;
    const { assignedStaff } = req.body;

    const appointment = await Appointment.findByPk(id);
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