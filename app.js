const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;
const initiateTheServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });

    app.listen(3001, () => {
      console.log("server is running");
    });
  } catch (e) {
    console.log(`Error Database: ${e.message}`);
    process.exit(1);
  }
};

initiateTheServer();

// user login
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}'`;
  const userData = await db.get(selectUserQuery);

  if (userData === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkingPassword = await bcrypt.compare(password, userData.password);
    if (checkingPassword) {
      const payload = { username: username };
      const jsonToken = await jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jsonToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//middleware

let jwtToken;
const authenticateToken = (request, response, next) => {
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

const convertStatesObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

//get all states

app.get("/states/", authenticateToken, async (request, response) => {
  const getAllStatesQuery = `
    SELECT
    *
    FROM state

    ORDER BY state_id
    `;
  const getStates = await db.all(getAllStatesQuery);
  response.send(
    getStates.map((eachStates) =>
      convertStatesObjectToResponseObject(eachStates)
    )
  );
});

//get single state

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getAllStatesQuery = `
    SELECT
    *
    FROM state
    WHERE state_id = ${stateId}
    `;
  const getState = await db.get(getAllStatesQuery);
  response.send(convertStatesObjectToResponseObject(getState));
});

//post district
app.post("/districts/", authenticateToken, async (request, response) => {
  const postBody = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = postBody;
  const postAllDistrictsQuery = `
     INSERT INTO district
     (district_name, state_id, cases, cured, active, deaths) VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths})
    `;
  const postDistricts = await db.run(postAllDistrictsQuery);

  response.send("District Successfully Added");
});

const convertDistrictObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//get single district

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getAllDistrictQuery = `
    SELECT
    *
    FROM district
    WHERE district_id= ${districtId}
    `;
    const getDistrict = await db.get(getAllDistrictQuery);
    response.send(convertDistrictObjectToResponseObject(getDistrict));
  }
);

//delete district;
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM district
        WHERE district_id=${districtId}
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//put district
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const putBody = request.body;
    const { districtId } = request.params;
    const { districtName, stateId, cases, cured, active, deaths } = putBody;
    const putAllDistrictQuery = `
     UPDATE district
     SET
     district_name='${districtName}', state_id=${stateId}, cases=${cases}, cured=${cured}, active=${active}, deaths=${deaths}
     WHERE district_id=${districtId}
    `;
    await db.run(putAllDistrictQuery);
    response.send("District Details Updated");
  }
);

const convertStateStatsObjectToResponseObject = (dbObject) => {
  return {
    totalCases: dbObject.cases,
    totalCured: dbObject.cured,
    totalActive: dbObject.active,
    totalDeaths: dbObject.deaths,
  };
};
//get single state stats

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
    SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths

    FROM district
    WHERE state_id= ${stateId}
    `;
    const getStateStats = await db.get(getStateStatsQuery);
    response.send(getStateStats);
  }
);

//get single state name

app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateIdQuery = `
    SELECT
    *
    FROM district
    WHERE district_id= ${districtId}
    `;
    const stateIdFromTableDistrict = await db.get(getStateIdQuery);

    const getStateNameQuery = ` SELECT 
    state_name as stateName 
    FROM state 
    WHERE state_id=${stateIdFromTableDistrict.state_id}`;

    const getStateName = await db.get(getStateNameQuery);
    response.send(getStateName);
  }
);

module.exports = app;
