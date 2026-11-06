// Configuração da APP: parte de app.json e junta o google-services.json (Firebase) quando o ficheiro existe.
// Sem o Firebase, as notificações no telemóvel não chegam aos Android, mas a APP funciona na mesma.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, "google-services.json"))) {
    config.android = { ...config.android, googleServicesFile: "./google-services.json" };
  }
  return config;
};
