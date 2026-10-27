
const Service = require("../models/Service");
const { Op } = require("sequelize");

// --------------------------------------------------
// DEFAULT VALUES
// --------------------------------------------------

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=800&q=80";

const DEFAULT_BENEFITS = [
  "Premium consultation",
  "Expert care",
];

// --------------------------------------------------
// MODEL HELPERS
// --------------------------------------------------

const hasField = (field) =>
  Object.prototype.hasOwnProperty.call(
    Service.rawAttributes || {},
    field
  );

const getField = (...fields) =>
  fields.find((field) => hasField(field));

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const parseBenefits = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return [...DEFAULT_BENEFITS];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return [value.trim()];
  }
};

const serializeBenefits = (value) => {
  if (value === undefined) return undefined;

  const benefits = parseBenefits(value);

  const attribute = Service.rawAttributes?.benefits;
  const dataType = attribute?.type?.key;

  // Keep arrays as arrays when the database column is JSON.
  if (dataType === "JSON" || dataType === "JSONB") {
    return benefits;
  }

  // For TEXT or STRING columns, store JSON as text.
  return JSON.stringify(benefits);
};

const formatService = (service) => {
  const item =
    typeof service.toJSON === "function"
      ? service.toJSON()
      : { ...service };

  const trendingField = getField(
    "isTrending",
    "is_trending"
  );

  const discountField = getField(
    "discountApplicable",
    "discount_applicable"
  );

  return {
    ...item,
    benefits: parseBenefits(item.benefits),
    isTrending: toBoolean(
      trendingField ? item[trendingField] : undefined,
      false
    ),
    discountApplicable: toBoolean(
      discountField ? item[discountField] : undefined,
      true
    ),
  };
};

const sendServerError = (res, operation, error) => {
  console.error(`\n❌ ${operation} ERROR`);
  console.error("Message:", error.message);
  console.error("SQL:", error.sql || "Not available");
  console.error(
    "Database error:",
    error.parent?.message ||
      error.original?.message ||
      "Not available"
  );

  return res.status(500).json({
    success: false,
    message: `${operation} failed.`,
    error: error.message,
    databaseError:
      error.parent?.message ||
      error.original?.message ||
      null,
  });
};

const getNumericId = (id) => {
  if (!/^\d+$/.test(String(id))) return null;

  const numericId = Number(id);

  if (!Number.isSafeInteger(numericId) || numericId < 1) {
    return null;
  }

  return numericId;
};

// --------------------------------------------------
// 1. GET ALL SERVICES
// GET /api/services
// --------------------------------------------------

exports.getAllServices = async (req, res) => {
  try {
    const options = {};

    if (hasField("createdAt")) {
      options.order = [["createdAt", "DESC"]];
    }

    const services = await Service.findAll(options);

    return res.status(200).json({
      success: true,
      data: services.map(formatService),
    });
  } catch (error) {
    return sendServerError(res, "Fetch services", error);
  }
};

// --------------------------------------------------
// 2. GET SERVICE BY ID OR SEARCH NAME/CATEGORY
// GET /api/services/:id
// --------------------------------------------------

exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    let service = null;

    const numericId = getNumericId(id);

    if (numericId !== null) {
      service = await Service.findByPk(numericId);
    }

    // Preserve the existing name/category search behavior
    // when no service is found using the numeric ID.
    if (!service) {
      const searchConditions = [];

      if (hasField("name")) {
        searchConditions.push({
          name: { [Op.like]: `%${id}%` },
        });
      }

      if (hasField("category")) {
        searchConditions.push({
          category: { [Op.like]: `%${id}%` },
        });
      }

      if (searchConditions.length > 0) {
        service = await Service.findOne({
          where: {
            [Op.or]: searchConditions,
          },
        });
      }
    }

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: formatService(service),
    });
  } catch (error) {
    return sendServerError(res, "Get service", error);
  }
};

// --------------------------------------------------
// 3. CREATE SERVICE
// POST /api/services
// --------------------------------------------------

exports.createService = async (req, res) => {
  try {
    const body = req.body || {};

    const {
      name,
      title,
      category,
      price,
      duration,
      image,
      description,
      desc,
      benefits,
      type,
      isTrending,
      is_trending,
      discountApplicable,
      discount_applicable,
      rating,
      reviews,
    } = body;

    const serviceName = String(name ?? title ?? "").trim();

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        message: "Service name is required.",
      });
    }

    if (
      price === undefined ||
      price === null ||
      price === "" ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid, non-negative service price is required.",
      });
    }

    const serviceData = {};

    // Required/core fields
    if (hasField("name")) {
      serviceData.name = serviceName;
    } else if (hasField("title")) {
      serviceData.title = serviceName;
    } else {
      return res.status(500).json({
        success: false,
        message:
          'Service model must define a "name" or "title" field.',
      });
    }

    if (hasField("category")) {
      serviceData.category = category || "General";
    }

    if (hasField("price")) {
      serviceData.price = Number(price);
    }

    if (hasField("duration")) {
      serviceData.duration = duration || "45 mins";
    }

    if (hasField("image")) {
      serviceData.image = image || DEFAULT_IMAGE;
    }

    const serviceDescription =
      description ?? desc ?? "Premium BeautyVibe service.";

    if (hasField("description")) {
      serviceData.description = serviceDescription;
    } else if (hasField("desc")) {
      serviceData.desc = serviceDescription;
    }

    if (hasField("benefits")) {
      serviceData.benefits = serializeBenefits(
        benefits ?? DEFAULT_BENEFITS
      );
    }

    if (hasField("type")) {
      serviceData.type = type || "SALON";
    }

    if (hasField("rating")) {
      serviceData.rating = rating ?? "5.0";
    }

    if (hasField("reviews")) {
      serviceData.reviews = reviews ?? "0";
    }

    const trendingField = getField(
      "isTrending",
      "is_trending"
    );

    if (trendingField) {
      serviceData[trendingField] = toBoolean(
        isTrending ?? is_trending,
        false
      );
    }

    const discountField = getField(
      "discountApplicable",
      "discount_applicable"
    );

    if (discountField) {
      serviceData[discountField] = toBoolean(
        discountApplicable ?? discount_applicable,
        true
      );
    }

    const newService = await Service.create(serviceData);

    return res.status(201).json({
      success: true,
      message: "Service created successfully.",
      data: formatService(newService),
    });
  } catch (error) {
    return sendServerError(res, "Create service", error);
  }
};

// --------------------------------------------------
// 4. UPDATE SERVICE
// PUT /api/services/:id
// --------------------------------------------------

exports.updateService = async (req, res) => {
  try {
    const id = getNumericId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: `Service with ID ${id} was not found.`,
      });
    }

    const body = req.body || {};
    const updates = {};

    // Name / title
    const incomingName =
      body.name !== undefined ? body.name : body.title;

    if (incomingName !== undefined) {
      const newName = String(incomingName).trim();

      if (!newName) {
        return res.status(400).json({
          success: false,
          message: "Service name cannot be empty.",
        });
      }

      const nameField = getField("name", "title");

      if (nameField) {
        updates[nameField] = newName;
      }
    }

    // Category
    if (body.category !== undefined && hasField("category")) {
      updates.category = body.category;
    }

    // Price
    if (body.price !== undefined) {
      if (
        body.price === null ||
        body.price === "" ||
        !Number.isFinite(Number(body.price)) ||
        Number(body.price) < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Enter a valid, non-negative price.",
        });
      }

      if (hasField("price")) {
        updates.price = Number(body.price);
      }
    }

    // Duration
    if (body.duration !== undefined && hasField("duration")) {
      updates.duration = body.duration;
    }

    // Image
    if (body.image !== undefined && hasField("image")) {
      updates.image = body.image || DEFAULT_IMAGE;
    }

    // Description
    const incomingDescription =
      body.description !== undefined
        ? body.description
        : body.desc;

    if (incomingDescription !== undefined) {
      const descriptionField = getField(
        "description",
        "desc"
      );

      if (descriptionField) {
        updates[descriptionField] = incomingDescription;
      }
    }

    // Benefits
    if (body.benefits !== undefined && hasField("benefits")) {
      updates.benefits = serializeBenefits(body.benefits);
    }

    // Type
    if (body.type !== undefined && hasField("type")) {
      updates.type = body.type;
    }

    // Trending status: accept both field names
    const incomingTrending =
      body.isTrending !== undefined
        ? body.isTrending
        : body.is_trending;

    const trendingField = getField(
      "isTrending",
      "is_trending"
    );

    if (incomingTrending !== undefined && trendingField) {
      updates[trendingField] = toBoolean(incomingTrending);
    }

    // Discount status: accept both field names
    const incomingDiscount =
      body.discountApplicable !== undefined
        ? body.discountApplicable
        : body.discount_applicable;

    const discountField = getField(
      "discountApplicable",
      "discount_applicable"
    );

    if (incomingDiscount !== undefined && discountField) {
      updates[discountField] = toBoolean(incomingDiscount);
    }

    // Rating and reviews, if the model supports them
    if (body.rating !== undefined && hasField("rating")) {
      updates.rating = body.rating;
    }

    if (body.reviews !== undefined && hasField("reviews")) {
      updates.reviews = body.reviews;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No supported fields were provided for updating this service.",
      });
    }

    await service.update(updates);
    await service.reload();

    return res.status(200).json({
      success: true,
      message: "Service updated successfully.",
      data: formatService(service),
    });
  } catch (error) {
    return sendServerError(res, "Update service", error);
  }
};

// --------------------------------------------------
// 5. DELETE SERVICE
// DELETE /api/services/:id
// --------------------------------------------------

exports.deleteService = async (req, res) => {
  try {
    const id = getNumericId(req.params.id);

    if (id === null) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await Service.findByPk(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: `Service with ID ${id} was not found.`,
      });
    }

    await service.destroy();

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully.",
      data: { id: String(id) },
    });
  } catch (error) {
    return sendServerError(res, "Delete service", error);
  }
};
