const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const User = require("../models/User");

// --------------------------------------------------
// FIREBASE ADMIN INITIALIZATION
// --------------------------------------------------

let firebaseInitialized = false;

const initializeFirebaseAdmin = () => {
  if (firebaseInitialized || admin.apps.length > 0) {
    firebaseInitialized = true;
    return;
  }

  const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJSON) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing from backend environment variables."
    );
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(serviceAccountJSON);
  } catch (error) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: " + error.message
    );
  }

  // CRITICAL FIX: Ensure private key newlines are correctly parsed 
  // whether stored with actual newlines or literal '\\n' characters.
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  firebaseInitialized = true;
};

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

const protect = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please sign in.",
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    let decodedToken = null;

    // 1. Try existing backend JWT first.
    try {
      if (process.env.JWT_SECRET) {
        decodedToken = jwt.verify(token, process.env.JWT_SECRET);

        if (decodedToken?.id) {
          const user = await User.findByPk(decodedToken.id, {
            attributes: {
              exclude: ["password"],
            },
          });

          if (user) {
            req.user = user;
            req.authType = "backend-jwt";
            return next();
          }
        }
      }
    } catch (jwtError) {
      // Token is either invalid backend JWT or a Firebase ID token. Proceed to Firebase check.
      decodedToken = null;
    }

    // 2. Verify Firebase ID token.
    initializeFirebaseAdmin();

    const firebaseUser = await admin.auth().verifyIdToken(token, true);

    const authenticatedEmail = firebaseUser.email?.toLowerCase().trim();
    const firebaseUid = firebaseUser.uid;
    const firebaseName = firebaseUser.name || firebaseUser.displayName || "Valued Customer";

    if (!authenticatedEmail) {
      return res.status(401).json({
        success: false,
        message: "Your Firebase account does not have a verified email.",
      });
    }

    // 3. Find the corresponding account in MySQL.
    let user = await User.findOne({
      where: {
        email: authenticatedEmail,
      },
      attributes: {
        exclude: ["password"],
      },
    });

    if (!user) {
      /* 
        NOTE: If you want new Google/Firebase users to automatically register 
        in your MySQL database on their first login, uncomment the block below. 
        Otherwise, it will correctly enforce pre-registration with a 403 error.
      */
      /*
      user = await User.create({
        name: firebaseName,
        email: authenticatedEmail,
        role: "user", // Default role
      });
      */

      return res.status(403).json({
        success: false,
        message:
          "Your account is authenticated, but it is not registered in the database. Contact the administrator.",
      });
    }

    req.user = user;
    req.firebaseUid = firebaseUid;
    req.authType = "firebase";

    return next();
  } catch (error) {
    console.error("[AUTH] Authentication failed:", error.message);

    if (
      error.code === "auth/id-token-expired" ||
      error.code === "auth/argument-error" ||
      error.code === "auth/invalid-id-token"
    ) {
      return res.status(401).json({
        success: false,
        message: "Your session has expired or is invalid. Please sign in again.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Authentication failed. Please sign in again.",
    });
  }
};

// --------------------------------------------------
// ADMIN AUTHORIZATION
// --------------------------------------------------

const adminOnly = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase().trim();

  if (role === "admin" || role === "superadmin") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Administrator permission is required.",
  });
};

module.exports = {
  protect,
  adminOnly,
};