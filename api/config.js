module.exports = async function handler(req, res) {
  const apiBaseUrl = process.env.FRONTEND_API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080";
  const pixKey = process.env.PIX_KEY || "";
  
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  
  const content = `window.PULSEPAY_CONFIG = ${JSON.stringify({ apiBaseUrl, pixKey })};`;
  
  return res.status(200).send(content);
};
