const Appointment = require('../models/Appointment');
const User = require('../models/User');

exports.getFinancials = async (req, res) => {
  try {
    // Fetch all appointments to calculate real revenue
    const appointments = await Appointment.findAll({
      include: [{ model: User, as: 'user', attributes: ['name', 'avatar'], required: false }],
      order: [['createdAt', 'DESC']]
    });

    let totalRevenue = 0;
    let successfulPayments = 0;
    let pendingSettlements = 0;
    let refundsIssued = 0;

    const transactions = [];
    const refunds = [];

    appointments.forEach(app => {
      const amount = Number(app.amount) || 0;
      const customerName = app.user?.name || app.customerName || 'Valued Client';
      const avatar = app.user?.avatar || '';

      // Determine financial status based on booking status
      let paymentStatus = 'Pending';
      if (app.status === 'Completed') paymentStatus = 'Success';
      if (app.status === 'Rejected') paymentStatus = 'Refunded';

      // Aggregate Stats
      if (app.status === 'Completed') {
        totalRevenue += amount;
        successfulPayments += 1;
      } else if (app.status === 'Accepted' || app.status === 'Pending') {
        pendingSettlements += amount;
      } else if (app.status === 'Rejected') {
        refundsIssued += amount;
      }

      // Build Transaction Record
      if (app.status !== 'Rejected') {
        transactions.push({
          id: app.id,
          transactionId: app.passCode || `TXN-${app.id}`,
          customer: customerName,
          avatar: avatar,
          service: app.serviceName || 'Beauty Ritual',
          amount: amount,
          method: 'Online / UPI',
          status: paymentStatus,
          createdAt: app.createdAt
        });
      }

      // Build Refund Record if Rejected
      if (app.status === 'Rejected') {
        refunds.push({
          id: app.id,
          refundId: `REF-${app.id}`,
          customer: customerName,
          avatar: avatar,
          service: app.serviceName || 'Beauty Ritual',
          amount: amount,
          reason: 'Booking Cancelled/Rejected',
          status: 'Processed', // Automatically mark processed for cancelled bookings
          createdAt: app.updatedAt
        });
      }
    });

    // Format Stats for UI
    const formatCurrency = (val) => `₹${val.toLocaleString("en-IN")}`;

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalRevenue: formatCurrency(totalRevenue),
          successfulPayments,
          pendingSettlements: formatCurrency(pendingSettlements),
          refundsIssued: formatCurrency(refundsIssued)
        },
        transactions,
        refunds
      }
    });

  } catch (error) {
    console.error("Fetch Financials Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};