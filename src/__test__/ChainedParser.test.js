const ChainedParser = require("../ChainedParser");
const { test } = require("zora");

test("Testing 'skip' method", (t) => {
  const data = [0xf0, 0x0f, 0xff, 0x00];

  const chainedParser = new ChainedParser(data)
    .skip(4) // skip first half
    .next(4, "secondHalfOfFirstByte")
    .skip(8) // second byte
    .next(16, "_3rdAnd4thBytes")
    .exec();

  const output = chainedParser.result;

  const expected = {
    secondHalfOfFirstByte: 0,
    _3rdAnd4thBytes: 0xff00,
  };

  t.equal(output, expected);
});

test("Testing basic 'next' method", (t) => {
  const data = [255, 0, 0, 255];

  const parser = new ChainedParser(data);

  const output1 = parser
    .next(8, "firstByte")
    .next(8, "secondByte")
    .next(8, "thirdByte")
    .next(8, "fourthByte").result;

  const expected1 = {
    firstByte: 255,
    secondByte: 0,
    thirdByte: 0,
    fourthByte: 255,
  };

  t.equal(output1, expected1);

  const output2 = parser
    .reset()
    .next(16, "firstHalf")
    .next(16, "secondHalf").result;

  const expected2 = {
    firstHalf: 65280,
    secondHalf: 255,
  };

  t.equal(output2, expected2);
});

test("Testing the 'endianness' method", (t) => {
  const data = [0x12, 0x34, 0x12, 0x34];

  const parser = new ChainedParser(data);

  const output = parser
    .endianness("big")
    .next(8, "big8BitsA")
    .next(8, "big8BitsB")
    .goBack(16)
    .next(16, "big16Bits")
    .endianness("little")
    .next(16, "small16Bits").result;

  const expected = {
    big8BitsA: 18,
    big8BitsB: 52,
    big16Bits: 4660,
    small16Bits: 11336,
  };

  t.equal(output, expected);
});

test("Testing the 'registerSize' method", (t) => {
  const data = [1, 1, 1, 1];

  const parser = new ChainedParser(data);

  const output1 = parser
    .registerSize(8) // 8 bits by default.
    .next(8, "firstByte")
    .next(8, "secondByte")
    .next(8, "thirdByte")
    .next(8, "fourthByte").result;

  const expected1 = {
    firstByte: 1,
    secondByte: 1,
    thirdByte: 1,
    fourthByte: 1,
  };

  t.equal(output1, expected1);

  const output2 = parser
    .reset() // re-parse the same array
    .registerSize(4)
    .next(8, "firstByte")
    .next(8, "secondByte").result;

  const output3 = new ChainedParser(data)
    .registerSize(4) // must be called before reset
    .next(8, "firstByte")
    .next(8, "secondByte").result;

  const expected2 = {
    firstByte: 0b00010001,
    secondByte: 0b00010001,
  };

  t.equal(output2, expected2);
  t.equal(output3, expected2);
});

test("Testing the parsing of unfinished data", (t) => {
  const data = [0xf0, 0x0f, 0xff, 0xaa];

  const parser = new ChainedParser(data);

  const output1 = parser
    .skip(3 * 8) // skip 3 bytes
    .next(6, "first6Bits")
    .next(3, "shouldntExist").result;

  const expected1 = {
    first6Bits: 0b101010,
  };

  // Should not parse unfinished data
  t.equal(output1, expected1);

  const output2 = parser
    .reset() // re-parse the same array
    .parseUnfinished(true) // false by default, set as true
    .skip(3 * 8) // skip 3 bytes
    .next(6, "first6Bits")
    .next(3, "unfinishedData").result;

  const expected2 = {
    first6Bits: 0b101010,
    unfinishedData: 0b10,
  };

  // Should parse unfinished data
  t.equal(output2, expected2);
});

test("Testing formatter function option", (t) => {
  const data = [12, 34, 56, 78];

  const parser = new ChainedParser(data);

  const addTen = (val) => val + 10;

  const output1 = parser
    .next(8, "firstByte", { formatter: addTen })
    .next(8, "secondByte", { formatter: addTen })
    .next(8, "thirdByte", { formatter: addTen })
    .next(8, "fourthByte", { formatter: addTen }).result;

  const expected1 = {
    firstByte: 22,
    secondByte: 44,
    thirdByte: 66,
    fourthByte: 88,
  };

  t.equal(output1, expected1);
});

test("Testing save condition option", (t) => {
  const data = [12, 34, 56, 78];

  const parser = new ChainedParser(data);

  const addTen = (val) => val + 10;

  const output1 = parser
    .next(8, "firstByte", { saveCondition: (val) => val > 3 }) // should save
    .next(8, "secondByte", { saveCondition: (val) => val < 3 }) // shouldn't save
    .next(8, "thirdByte", {
      formatter: addTen,
      saveCondition: (val) => val > 3,
    }) // should save
    .next(8, "fourthByte", {
      formatter: addTen,
      saveCondition: (val) => val < 3,
    }).result; // shouldn't save

  const expected1 = {
    firstByte: 12,
    thirdByte: 66,
  };

  t.equal(output1, expected1);
});

test("Testing 'choice' option", (t) => {
  const data = [1, 2, 3, 4];

  const parser = new ChainedParser(data);

  const addTen = (val) => val + 10;

  const parser1 = new ChainedParser().next(8, "a").next(8, "b");
  const parser2 = new ChainedParser().next(16, "c");

  // on selected choice
  const output1 = parser
    .next(8, "firstByte")
    .next(8, "secondByte", { formatter: addTen })
    .choice(
      "firstByte",
      {
        1: parser1,
      },
      parser2
    ).result;

  const expected1 = {
    firstByte: 1,
    secondByte: 12,
    a: 3,
    b: 4,
  };

  t.equal(output1, expected1);

  // on default choice
  const output2 = parser
    .next(8, "firstByte")
    .next(8, "secondByte", { formatter: addTen })
    .choice(
      "firstByte",
      {
        1: parser1,
      },
      parser2
    ).result;

  const expected2 = {
    firstByte: 1,
    secondByte: 12,
    a: 3,
    b: 4,
  };
  t.equal(output2, expected2);
});

test("Testing 'choice' option when chained to another 'choice'", (t) => {
  const data = [1, 2, 3, 4];

  const parser = new ChainedParser(data);

  const parser1 = new ChainedParser().next(16, "thirdAndFourthBytes");

  const parser2 = new ChainedParser()
    .next(8, "secondByte")
    .choice("firstByte", {
      1: parser1,
    });

  const parser3 = new ChainedParser()
    .next(8, "secondByte", { formatter: (val) => val + 10 })
    .next(16, "thirdAndFourthBytes");

  const output1 = parser.next(8, "firstByte").choice(
    "firstByte", // value is 1
    {
      10: parser3, // not used
    },
    parser2 // default path, used.
  ).result;

  const expected1 = {
    firstByte: 1,
    secondByte: 2,
    thirdAndFourthBytes: (3 << 8) + 4,
  };

  t.equal(output1, expected1);
});

test("Chaining 'choice' options in the same expression", (t) => {
  const data = [1, 2, 3, 4];

  const parser = new ChainedParser(data);

  const output1 = parser
    .next(8, "first")
    .choice(
      "first",
      {
        1: new ChainedParser().next(8, "second", {
          formatter: (val) => val + 1,
        }),
      },
      new ChainedParser().next(8, "second")
    )
    .choice(
      "second",
      {
        2: new ChainedParser().next(8, "third", {
          formatter: (val) => val + 1,
        }),
      },
      new ChainedParser().next(8, "third", {
        formatter: (val) => val + 2,
      })
    )
    .next(8, "fourth").result;

  const expected1 = {
    first: 1,
    second: 3,
    third: 5,
    fourth: 4,
  };

  t.equal(output1, expected1);
});

test("Testing 'goBack' option", (t) => {
  const data = [12, 34, 56, 78];

  const parser = new ChainedParser(data);

  const output1 = parser
    .next(8, "firstByte")
    .next(8, "secondByte")
    .goBack(8)
    .next(8, "secondByteAgain")
    .next(8, "thirdByte")
    .next(8, "fourthByte").result;

  const expected1 = {
    firstByte: 12,
    secondByte: 34,
    secondByteAgain: 34,
    thirdByte: 56,
    fourthByte: 78,
  };

  t.equal(output1, expected1);
});

test("Testing formatter function option", (t) => {
  const data = [12, 34, 56, 78];

  const parser = new ChainedParser(data);

  const addTen = (val) => val + 10;

  const output1 = parser
    .next(8, "firstByte", { formatter: addTen })
    .next(8, "secondByte", { formatter: addTen })
    .next(8, "thirdByte", { formatter: addTen })
    .next(8, "fourthByte", { formatter: addTen }).result;

  const expected1 = {
    firstByte: 22,
    secondByte: 44,
    thirdByte: 66,
    fourthByte: 88,
  };

  t.equal(output1, expected1);
});

test("Testing real life data from Teltonika device", (t) => {
  const latLongFormatter = (value) => value / 60000;
  const altitudeFormatter = (value) => value / 10;
  const speedFormatter = (value) => value; // in km/h
  const headingFormatter = (value) => value / 10;
  const eventTimeFormatter = (value) => value;

  const data = [
    128, 1, 82, 101, 192, 82, 101, 192, 0, 3, 13, 64, 207, 32, 240, 0, 0, 0, 0,
    0, 0, 0, 32, 0, 0, 0, 32, 0, 0, 0, 32, 0, 0, 0, 32, 0, 0, 0, 32, 0, 0, 1,
    128,
  ];

  const parser = new ChainedParser(data);

  const output1 = parser
    .skip(16)
    .next(24, "latitude", { formatter: latLongFormatter, signedness: "signed" })
    .next(25, "longitude", {
      formatter: latLongFormatter,
      signedness: "signed",
    })
    .next(31, "altitude", { formatter: altitudeFormatter })
    .next(10, "speed", { formatter: speedFormatter })
    .next(10, "heading", { formatter: headingFormatter })
    .next(31, "fixTime", { formatter: eventTimeFormatter })
    .next(32, "smokeSensor")
    .next(32, "panicButton")
    .next(32, "doorSensor")
    .next(32, "alarmSensor")
    .next(32, "immobilizer")
    .next(31, "engineState").result;

  const expected1 = {
    latitude: 90,
    longitude: 180,
    altitude: 20000,
    speed: 828,
    heading: 52.7,
    fixTime: 0,
    smokeSensor: 1,
    panicButton: 1,
    doorSensor: 1,
    alarmSensor: 1,
    immobilizer: 1,
    engineState: 6,
  };

  t.equal(output1, expected1);
});
