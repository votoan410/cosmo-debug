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

  // assume the return value should be an array due to find()
  const { discovery } = shuttles;
  const parsedDiscovery = JSON.parse(discovery);
  console.log("shuttle after read() here: ", parsedDiscovery);

  const checkDate = parsedDiscovery.date >= 0;
  const checkCapacity = parsedDiscovery.capacity > 0;
  console.log(checkDate, " vs ", checkCapacity);

  // const availableShuttle = shuttles.find(
  //   ({ date, capacity }) => date >= 0 && capacity > 0
  // );
  const availableShuttle = checkDate && checkCapacity;

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
