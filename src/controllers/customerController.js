const User = require('../models/User');

exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, data: customers });
  } catch (error) {
    console.error("Get Customers Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.upsertCustomer = async (req, res) => {
  try {
    const { name, email, phone, avatar, status, authProvider } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    let [customer, created] = await User.findOrCreate({
      where: { email },
      defaults: {
        name: name || 'User',
        phone: phone || '+91 98765 43210',
        avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80',
        status: status || 'Active',
        authProvider: authProvider || 'local'
      }
    });

    if (!created) {
      // Update existing record if needed
      await customer.update({
        name: name || customer.name,
        avatar: avatar || customer.avatar,
        authProvider: authProvider || customer.authProvider
      });
    }

    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    console.error("Upsert Customer Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const customer = await User.findByPk(id);

    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    customer.status = status;
    await customer.save();

    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await User.findByPk(id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    await customer.destroy();
    res.status(200).json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error("Delete Customer Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};