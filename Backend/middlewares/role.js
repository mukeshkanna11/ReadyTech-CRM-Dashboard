const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      /* 🔐 Check Authentication */
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      /* 🚫 Check Account Active */
      if (req.user.isActive === false) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated",
        });
      }

      /* 🔎 Check Role Permission */
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied: insufficient permissions",
        });
      }

      next();
    } catch (error) {
      console.error("⚠️ ROLE MIDDLEWARE ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Authorization error",
      });
    }
  };
};

export default authorize;
