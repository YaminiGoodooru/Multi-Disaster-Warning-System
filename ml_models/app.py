from flask import Flask, request, jsonify
import pickle
import numpy as np
import gdown
import os

app = Flask(__name__)

# Download models
def get_model(filename, file_id):
    if not os.path.exists(filename):
        gdown.download(f"https://drive.google.com/uc?id={file_id}", filename, quiet=False)
    with open(filename, "rb") as f:
        return pickle.load(f)

@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Disaster Prediction API is running!"})

@app.route("/predict/earthquake", methods=["POST"])
def predict_earthquake():
    model = get_model("earthquake_model.pkl", "1dBbC6vos1VG7HFQNANLBumGQGVg-4wyA")
    data = request.json
    features = np.array([[data["magnitude"], data["depth"],
                          data["tsunami"], data["significance"],
                          data["latitude"], data["longitude"]]])
    result = model.predict(features)[0]
    return jsonify({"risk": int(result), "message": "High Risk" if result == 1 else "Low Risk"})

@app.route("/predict/flood", methods=["POST"])
def predict_flood():
    model = get_model("flood_model.pkl", "1ABj6RBuKxPc9D-9Yb8XyZa76Z5cdDdxH")
    data = request.json
    features = np.array([[data["MonsoonIntensity"], data["TopographyDrainage"],
                          data["RiverManagement"], data["Deforestation"],
                          data["Urbanization"], data["ClimateChange"],
                          data["DamsQuality"], data["Siltation"],
                          data["AgriculturalPractices"], data["Encroachments"],
                          data["IneffectiveDisasterPreparedness"], data["DrainageSystems"],
                          data["CoastalVulnerability"], data["Landslides"],
                          data["Watersheds"], data["DeterioratingInfrastructure"],
                          data["PopulationScore"], data["WetlandLoss"],
                          data["InadequatePlanning"], data["PoliticalFactors"]]])
    result = model.predict(features)[0]
    return jsonify({"risk": int(result), "message": "High Risk" if result == 1 else "Low Risk"})

@app.route("/predict/cyclone", methods=["POST"])
def predict_cyclone():
    model = get_model("cyclone_model.pkl", "1BeCXGYOAme_AihPBTyUiPB5vgEQQ7mEc")
    data = request.json
    features = np.array([[data["pressure"], data["category"],
                          data["severity"], data["latitude"], data["longitude"]]])
    result = model.predict(features)[0]
    return jsonify({"risk": int(result), "message": "High Risk" if result == 1 else "Low Risk"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)