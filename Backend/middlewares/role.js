// middlewares/role.js
const role = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      if (req.user.role !== requiredRole) {
        return res.status(403).json({ message: "Access forbidden: insufficient permissions" });
      }

      next();
    } catch (error) {
      console.error("⚠️ ROLE ERROR:", error);
      res.status(403).json({ message: "Access denied" });
    }
  };
};

export default role;
