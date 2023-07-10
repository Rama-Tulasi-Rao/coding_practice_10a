const express = require("express");
const app = express();

app.use(express.json());

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

// Connecting to the Database
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(e.message);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// Get All State API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
            SELECT 
                *
            FROM 
                state;`;

  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) => ({
      stateId: eachState.state_id,
      stateName: eachState.state_name,
      population: eachState.population,
    }))
  );
});

// Get State API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
            SELECT
                *
            FROM 
                state
            WHERE 
                state_id = ${stateId};`;

  const state = await db.get(getStateQuery);
  const modifieldState = (state) => ({
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  });
  response.send(modifieldState(state));
});

// Add Districts API
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
            INSERT INTO 
                district(district_name, state_id, cases, cured, active, deaths)
            VALUES
                (
                    '${districtName}',
                     ${stateId},
                     ${cases},
                     ${cured},
                     ${active},
                     ${deaths}
                )
            ;`;

  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

// Get District API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
            SELECT 
                *
            FROM 
                district
            WHERE 
                district_id = ${districtId}  
    ;`;

    const district = await db.get(getDistrictQuery);
    const modifieldDistrict = (district) => ({
      districtId: district.district_id,
      districtName: district.district_name,
      stateId: district.state_id,
      cases: district.cases,
      cured: district.cured,
      active: district.active,
      deaths: district.deaths,
    });
    response.send(modifieldDistrict(district));
  }
);

// Delete District API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
            DELETE FROM 
                district
            WHERE 
                district_id = ${districtId};`;

    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// Update District Details API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
        UPDATE
            district
        SET
            district_name= '${districtName}',
            state_id= ${stateId},
            cases= ${cases},
            cured= ${cured},
            active= ${active},
            deaths= ${deaths}
        WHERE 
            district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// Get Stats API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
        SELECT 
            SUM(cases) AS totalCases,
            SUM(cured) AS totalCured,
            SUM(active) AS totalActive,
            SUM(deaths) AS totalDeaths
        FROM 
            district
        WHERE 
            state_id = ${stateId};`;
    const stats = await db.get(getStatsQuery);
    response.send(stats);
  }
);

// GET State Name API
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateIdQuery = `
            SELECT 
                *
            FROM 
                district
            WHERE 
                district_id= ${districtId}                 
            ;`;
    const district = await db.get(getStateIdQuery);
    const getStateQuery = `
             SELECT 
                state_name AS stateName
             FROM 
                state
             WHERE 
                state_id= ${district.state_id} 
     ;`;
    const stateName = await db.get(getStateQuery);
    response.send(stateName);
  }
);

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

module.exports = app;
