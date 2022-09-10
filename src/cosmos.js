const { init: initShuttleDb } = require("./dbs/shuttle");
const createSpaceTravelEmitter = require("./private/space-travel-emitter");
const log = require("./logger");
const shuttleUtil = require("./util/shuttle");
const cadet = require("./cadet");

const listen = async () => {
  // await will halt other operations untill a resolved promised is return
  const shuttleDb = await initShuttleDb();

  // expected output of following code:
  //   shuttleDb after await:  {
  //     getDbFilename: [Function: getDbFilename],
  //     open: [Function: bound open],
  //     read: [Function: bound read],
  //     write: [Function: bound write],
  //     delete: [Function: bound delete]
  //   }
  console.log("shuttleDb after await: ", shuttleDb);

  const spaceTravelEmitter = createSpaceTravelEmitter();
  let totalCrewCount = 0;
  spaceTravelEmitter.on("space-request", (evt) => {
    log("space-request", evt);
    ++totalCrewCount;
    onSpaceTravelRequested({ shuttleDb, ...evt });
  });
  spaceTravelEmitter.on("end", async (evt) => {
    shuttleUtil.validateShuttles({
      shuttleMap: await shuttleDb.read(),
      crewCount: totalCrewCount,
    });
    log(
      [
        "no more space requests, exiting.",
        `db can be viewed: ${shuttleDb.getDbFilename()}`,
      ].join(" ")
    );
  });
};

const onSpaceTravelRequested = async ({ shuttleDb, cosmonautId }) => {
  // async and await so shuttleDB should be a promise
  const shuttles = await shuttleDb.read();

  // console.log output: the following value should be array
  // {
  //   discovery: '{"date":10,"name":"discovery","crew":[],"remainingCapacity":1}',
  //   'sputnik-2': '{"date":3,"name":"sputnik-2","crew":[],"remainingCapacity":3}',
  //   'tom-hanks': '{"date":-5,"name":"tom-hanks","crew":[],"remainingCapacity":0}'
  // }
  // console.log(shuttles);

  const separateObject = (obj) => {
    const res = [];
    const keys = Object.keys(obj);
    console.log("keys values: ", keys);
    keys.forEach((key) => {
      res.push(JSON.parse(obj[key]));
    });
    return res;
  };
  const shuttlesParsed = separateObject(shuttles);

  // assume the return value should be an array due to find()
  const availableShuttle = shuttlesParsed.find(
    ({ date, remainingCapacity }) => {
      return date >= 0 && remainingCapacity > 0;
    }
  );

  if (!availableShuttle) {
    throw new Error(
      `unable to schedule cosmonautId ${cosmonautId}, no shuttles available`
    );
  }
  log(
    `found shuttle for cosmonautId ${cosmonautId}, shuttle ${availableShuttle.name}`
  );
  --availableShuttle.remainingCapacity;
  availableShuttle.crew.push(cosmonautId);
  await shuttleDb.write(availableShuttle.name, availableShuttle);
  await cadet.logWelcomeLetter({ cosmonautId, shuttle: availableShuttle });
};

module.exports = {
  listen,
};
