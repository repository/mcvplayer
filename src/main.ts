import root from "app-root-path";
import archiver from "archiver";
import Progress from "cli-progress";
import { createWriteStream, promises as fs } from "fs";
import { join } from "path";
import rimraf from "rimraf";
import Sharp from "sharp";
import { promisify } from "util";

import { Config } from "./Config";

const NAMESPACE_FORMAT = /^[a-z0-9-_]+$/;

const config: Config = root.require("config.json");
const rmrf = promisify(rimraf);

async function processFrame(
  frame: number,
  out: string,
  bar: Progress.SingleBar
) {
  let func = "";
  func += `bossbar set ${config.namespace}:video value ${
    frame - config.frame_start
  }\n`;

  const file = root.resolve("frames/" + frame + ".png");
  const outFile = join(out, frame + ".mcfunction");

  const sharp = Sharp(file);
  let raw: Buffer;
  try {
    const { channels } = await sharp.metadata();

    if (channels !== 3) {
      throw console.error(
        `Frame ${frame} has ${channels} channels, 3 expected`
      );
    }
    const pixels: number[] = [];
    raw = await sharp.raw().toBuffer();

    for (let i = 0; i < raw.length; i += 3) {
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 1];

      const pixel = (r << 16) + (g << 8) + b;
      pixels.push(pixel);
    }

    func += `data modify storage ${
      config.namespace
    }:frame pixels set value [${pixels.join()}]\n`;
    func += `function ${config.namespace}:setframe\n`;
  } catch {
    console.error("Unable to read frame " + frame + " - SKIPPING");
  }

  if (frame === config.frame_end)
    func += `bossbar remove ${config.namespace}:video\n`;

  bar.increment();
  await fs.writeFile(outFile, func);
}

function frameFunction() {
  let func = "";

  let x = 0;
  let z = 0;
  let i = 0;

  while (x != config.width && z != config.height) {
    func += `data modify block ${x + config.base_x} ${config.base_y} ${
      z + config.base_y
    } SpawnData.ArmorItems[3].tag.display.color set from storage ${
      config.namespace
    }:frame pixels[${i}]\n`;

    i++;
    x++;
    if (x == config.width) {
      x = 0;
      z++;
    }
  }

  return func;
}

function playFunction() {
  const frames = config.frame_end - config.frame_start;

  let func = "";

  func += `bossbar add ${config.namespace}:video "${config.title}"\n`;
  func += `bossbar set ${config.namespace}:video players @a\n`;
  func += `bossbar set ${config.namespace}:video max ${
    config.frame_end - config.frame_start
  }\n`;

  for (let i = 0; i <= frames; i++) {
    func += `schedule function ${config.namespace}:${
      config.frame_start + i
    } ${i}\n`;
  }

  return func;
}

function fillFunction() {
  return `fill ${config.base_x} ${config.base_y} ${config.base_z} ${
    config.base_x + config.width - 1
  } ${config.base_y} ${
    config.base_z + config.height - 1
  } spawner{"SpawnData":{"id":"minecraft:armor_stand","Invisible":1,"Marker":1,"ArmorItems":[{},{},{},{"id":"minecraft:leather_boots","Count":1b,"tag":{"Damage":0,"display":{"color":0}}}]},RequiredPlayerRange:0,MaxNearbyEntities:0}`;
}

async function createHelpers(fnDir: string) {
  await Promise.all([
    fs.writeFile(join(fnDir, "setframe.mcfunction"), frameFunction()),
    fs.writeFile(join(fnDir, "play.mcfunction"), playFunction()),
    fs.writeFile(join(fnDir, "fill.mcfunction"), fillFunction()),
  ]);
}

async function main() {
  if (!NAMESPACE_FORMAT.test(config.namespace))
    return console.error(
      "Invalid Namespace (see: https://minecraft.gamepedia.com/Namespaced_ID#Java_Edition)"
    );
  if (config.frame_end < config.frame_start)
    return console.error("End frame must be greater than start frame");
  if (config.width < 0 || config.height < 0)
    return console.error("Width and height must be positive");

  const outDir = root.resolve("out");
  try {
    await fs.access(outDir);
  } catch {
    console.log("Output directory doesnt exist, creating...");
    await fs.mkdir(outDir);
  }

  console.log("Deleting any artifacts from previous runs...");
  const zipfile = join(outDir, config.namespace + ".zip");
  await Promise.all([rmrf(join(outDir, config.namespace)), rmrf(zipfile)]);

  /**
   * create datapack directory structure
   *
   * <namespace>/
   * ├─ data/
   * │  ├─ <namespace>/
   * │  │  ├─ functions/
   * │  │  │  ├─ *.mcfunction
   * ├─ pack.mcmeta
   */

  console.log("Creating datapack structure...");

  const fnDir = join(
    outDir,
    config.namespace,
    "data",
    config.namespace,
    "functions"
  );

  await fs.mkdir(fnDir, { recursive: true });

  const mcmeta = {
    pack: {
      pack_format: 6,
      description: "mcvplayer: " + config.title,
    },
  };

  await fs.writeFile(
    join(outDir, config.namespace, "pack.mcmeta"),
    JSON.stringify(mcmeta)
  );

  console.log("Encoding frames...");
  const procs = [];

  const bar = new Progress.SingleBar(Progress.Presets.shades_classic);
  bar.start(config.frame_end - config.frame_start + 1, 0);

  for (let i = config.frame_start; i <= config.frame_end; i++) {
    procs.push(processFrame(i, fnDir, bar));
  }

  await Promise.all(procs);
  bar.stop();
  console.log("Finished encoding frames");

  console.log("Creating helper functions...");
  await createHelpers(fnDir);

  console.log("Datapack completed, packing...");
  const zip = createWriteStream(zipfile);
  const archive = archiver("zip", { zlib: { level: 9 } });

  zip.on("close", async () => {
    console.log("Done.");
    await rmrf(join(outDir, config.namespace));
  });

  archive.on("error", console.error);
  archive.pipe(zip);

  archive.directory(join(outDir, config.namespace), false);
  archive.finalize();
}
main();
