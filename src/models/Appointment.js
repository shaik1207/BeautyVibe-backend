const clean = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string" && typeof value !== "number") return "";

  const result = String(value).trim();
  if (!result) return "";

  const lower = result.toLowerCase();

  // Exclude placeholder or invalid string patterns
  if (/^(null|undefined|n\/a|na|undefined undefined|null null|valued client|walk-in client)$/.test(lower)) {
    return "";
  }

  // ABSOLUTELY EXCLUDE emails from being returned as customer names
  if (result.includes("@") && result.includes(".")) {
    return "";
  }

  if (
    result.includes("9876543210") ||
    result === "+91 98765 43210" ||
    result === "98765 43210"
  ) {
    return "";
  }

  return result;
};

function getCustomerDetails(item) {
  const user = isObject(item.user) ? item.user : {};
  const customer = isObject(item.customer) ? item.customer : {};
  const details = isObject(item.customerDetails) ? item.customerDetails : {};

  // Extract explicit First & Last Name
  const firstName = firstValue(
    item.firstName,
    details.firstName,
    user.firstName,
    customer.firstName
  );

  const lastName = firstValue(
    item.lastName,
    details.lastName,
    user.lastName,
    customer.lastName
  );

  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();

  // Extract Name strictly avoiding email strings
  const fullName = firstValue(
    combinedName,
    item.customerName,
    item.userName,
    item.name,
    item.fullName,
    details.name,
    details.fullName,
    customer.name,
    customer.fullName,
    user.name,
    user.fullName
  ) || "Valued Client";

  // Extract Mobile Phone with max field fallbacks
  const mobile = firstValue(
    item.mobileNumber,
    item.phone,
    item.phoneNumber,
    item.mobile,
    item.contact,
    details.mobileNumber,
    details.phone,
    details.mobile,
    details.contact,
    customer.mobileNumber,
    customer.phone,
    customer.mobile,
    user.phone,
    user.mobileNumber,
    user.mobile
  );

  const address = getUserAddress(user, item);

  return {
    firstName,
    lastName,
    name: fullName,
    mobile,
    address,
    avatar: firstValue(item.avatar, user.avatar, customer.avatar),
  };
}