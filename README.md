# mcvplayer
A full color video player, entirely within vanila Minecraft


This is the encorder portion of the project. It reads videos as a PNG sequence and outputs them in datapack form, ready for you to use.

A world file with Bad Apple is included [here](TBD).

The resource pack used to achieve the full color effect is available [here](TBD).

## Instructions
1. Ensure Node.js is installed (tested on v12.16.1)
2. Clone project
`git clone https://github.com/repository/mcvplayer.git`
3. Install dependencies
`npm install`
4. Build project
`npm build`
5. Configure -- see below for format
6. Load PNG sequence, the program expects filenames to be the frame number with a `.png` extension.
(ie. `9.png`, `251.png`, `1284.png`)
7. Run program
`node .`

After it is done, you will have a `.zip` file in `out/` when you can then place in your datapacks folder.
If you need any help, open an issue or contact me on Discord @ stan#1482
I'll try my best to help you.
## Configuration
The config file should be named `config.json` and be placed in the root of the project.

Example config:
```
{
  "namespace": "bapple",
  "title": "Bad Apple!!!",

  "width": 56,
  "height": 42,
  "base_x": 0,
  "base_y": 0,
  "base_z": 0,
  "frame_start": 1,
  "frame_end": 4381
}
```
The base coordinates refer to the top left corner of the video area.
