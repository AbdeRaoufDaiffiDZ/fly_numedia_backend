const jwt = require("jsonwebtoken");

module.exports.authMiddleware = async (req, res, next) => {
  console.log("auth Middlerware");
  const { accessToken } = req.cookies;
  console.log("accessToken", accessToken);
  
  if (!accessToken) {
    return res.status(409).json({ error: "Please login first" });
  } else {
    try {
      const deCodeToken = await jwt.verify(accessToken, process.env.SECRET);
      req.role = deCodeToken.role;
      req.id = deCodeToken.id;
      next();
    } catch (error) {
      console.log("accesstoken getted but not valid");
      return res.status(409).json({ error: "Please login" });
    }
  }
};
