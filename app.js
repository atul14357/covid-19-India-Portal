const express = require("express");
const path = require("path");
const jwt=require("jsonwebtoken");
const bcrypt=require("bcrypt");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

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
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const logger = (request, response, next) => {
  console.log(request.query);
  next();
};

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
        request.username = payload.username;       
        next();
      }
    });
  }
};

const stateTableObj = (dbObject) => {
  return {
    stateId:dbObject.state_id,
stateName:dbObject.state_name,
population:dbObject.population,
};
};
const districtTableObj = (dbObject) => {
  return {
districtId:dbObject.district_id,
districtName:dbObject.district_name,
stateId:dbObject.state_id,
cases:dbObject.cases,
cured:dbObject.cured,
active:dbObject.active,
deaths:dbObject.deaths,
};
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
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

// Get Books API
app.get("/states/",authenticateToken, async (request, response) => {
  const getStateQuery = `
    SELECT
      *
    FROM
      state;`;
  const statesArray = await db.all(getStateQuery);
  response.send(
      statesArray.map(each=>stateTableObj(each))
      );
});



// add book
app.post("/districts/",authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
        districtName,
        stateId,
        cases , 
        cured,
        active,
        deaths          
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO
      district(district_name,state_id,cases,cured,active,deaths)    
      VALUES
      (
        '${districtName}',
         ${stateId},
         ${cases},
        ${cured},
         ${active},
         ${deaths}         
      );`;

  const dbResponse = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});
app.get("/districts/:districtId/",authenticateToken,async (request,response)=>{
const {districtId}=request.params;
const getDistrictQuery=`
        select * 
        from district
         where 
         district_id=${districtId};                
`;
const districtsArray = await db.get(getDistrictQuery);
  response.send(districtTableObj(districtsArray));

});
// update book
app.put("/districts/:districtId/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const districtDetails = request.body;
  const {
           districtName,
        stateId,
        cases , 
        cured,
        active,
        deaths     
  } = districtDetails;
  const updateDistrictQuery = `
    UPDATE
      district
    SET
       district_name='${districtName}',
        state_id= ${stateId},
        cases= ${cases},
       cured= ${cured},
        active= ${active},
         deaths=${deaths}   
      
    WHERE
      district_id = ${districtId};`;
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/",authenticateToken,async (request,response)=>{
const {stateId}=request.params;
const getStateQuery=`
        select * 
        from state
         where 
         state_id=${stateId};                
`;
const statesArray = await db.get(getStateQuery);
  response.send(stateTableObj(statesArray));

});
// delete book
app.delete("/districts/:districtId/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const deleteDistrictQuery = `
    DELETE FROM
      district
    WHERE
      district_id = ${districtId};`;
  await db.run(deleteDistrictQuery);
  response.send("District Removed");
});
app.get("/states/:stateId/stats/",authenticateToken, async (request, response) => {
        const {stateId}=request.params;
    const getStateQuery = `
    SELECT
      sum(cases),
      sum(cured) ,
      sum(active), 
      sum(deaths)       
    FROM
     district 
     where 
     state_id=${stateId};`;
  const statesArray = await db.get(getStateQuery);
  response.send({
      totalCases:statesArray["sum(cases)"],
      totalCured:statesArray["sum(cured)"],
      totalActive:statesArray["sum(active)"],
      totalDeaths:statesArray["sum(deaths)"]     
  });
});
app.get("/districts/:districtId/details/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictStateQuery = `
    SELECT
     state_name
    FROM
     district natural join state 
    WHERE
      district_id = ${districtId};`;
  const statesArray = await db.get(getDistrictStateQuery);
  response.send({stateName:statesArray.state_name}
  );
});

module.exports=app;