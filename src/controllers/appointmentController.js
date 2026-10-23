const Appointment = require('../models/Appointment');
const Service = require('../models/Service');
const User = require('../models/User');

const processedRequests = new Set();

exports.getUserAppointments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const queryOptions = isAdmin ? {} : { where: { userId } };

    // Safely include associations now that they are declared in Appointment.js
    queryOptions.include = [
      {
        model: Service,
        as: 'service',
        attributes: ['name', 'category', 'duration', 'image'],
        required: false
      },
      {
        model: User,
        as: 'user',
        attributes: ['name', 'email', 'phone', 'avatar'],
        required: false
      }
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

exports.createAppointment = async (req, res) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.requestId;

    if (idempotencyKey && processedRequests.has(idempotencyKey)) {
      const existing = await Appointment.findOne({ where: { requestId: idempotencyKey } });
      if (existing) {
        return res.status(200).json({
          success: true,
          duplicateRequest: true,
          message: 'Appointment already processed.',
          data: existing
        });
      }
    }

    const { serviceId, serviceName, category, amount, type, date, time, requestId } = req.body;
    const userId = req.user?.id || 1;

    if (!serviceName || !date || !time) {
      return res.status(400).json({ success: false, message: 'Please provide service name, date, and time.' });
    }

    const passCode = `PASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const appointment = await Appointment.create({
      userId,
      serviceId: serviceId || 1,
      serviceName,
      category: category || 'General',
      amount: amount || 999,
      type: type || 'SALON',
      date,
      time,
      status: 'Pending', // Strictly defaults to Pending
      passCode,
      requestId: requestId || idempotencyKey || `REQ-${Date.now()}`,
    });

    if (idempotencyKey) {
      processedRequests.add(idempotencyKey);
    }

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
    return res.status(500).json({ success: false, message: error.message || 'Internal server error.' });
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
    if (io) {
      io.emit('appointmentUpdated', appointment);
    }

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
    if (io) {
      io.emit('appointmentUpdated', appointment);
    }

    return res.status(200).json({ success: true, message: 'Expert assigned successfully.', data: appointment });
  } catch (error) {
    console.error("Assign Staff Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};