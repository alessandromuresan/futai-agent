#!/usr/bin/env node

'use strict';

const youtubedl = require('youtube-dl');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;

let program = require('commander');

program.version('0.0.1')
    .option('-p, --playlist <playlist>', 'Youtube playlist id to download')
    .option('-u, --url <url>', 'The URL for the Youtube playlist (this has priority over the --playlist parameter)')
    .option('-o, --output <output>', 'The directory in which to download the Youtube playlist to')
    .option('-w, --winampPath <winampPath>', 'Optional path to winamp.exe (defaults to "C:\\Program Files (x86)\\Winamp\\winamp.exe")');

program.on('--help', function(){
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ futai --playlist "PLSgyieXjxY_edCma2rZlwugFgvhldDU8-" --output "C:\\Users\\Mufi\\Desktop\\MuhMusic"');
    console.log('');
});

program.parse(process.argv);

if (!program.output) {
    console.error('The --output parameter is mandatory');
    return;
}

if (!program.playlist && !program.url) {
    console.error('Please provide either the --playlist or the --url parameters');
    return;
}

const playlistId = program.playlist;
const playlistDir = program.output;

let winampPath = program.winampPath || "C:\\Program Files (x86)\\Winamp\\winamp.exe";
let playlistUrl = program.url || `https://www.youtube.com/playlist?list=${playlistId}`;

if (winampPath[0] !== '"') {
    winampPath = '"' + winampPath
}

if (winampPath[winampPath.length - 1] !== '"') {
    winampPath = winampPath + '"'
}

if (!fs.existsSync(playlistDir)){
    fs.mkdirSync(playlistDir);
}

let playlistInfoFile = path.join(playlistDir, 'playlist.json');

if (!fs.existsSync(playlistInfoFile)) {
    fs.writeFileSync(playlistInfoFile, JSON.stringify({ videos: [] }, null, 4), { encoding: 'utf8' });
}

console.log();
console.log('Foreplay, please wait...');
console.log();
console.log(`All videos will be downloaded to ${playlistDir}`);
console.log();
console.log(`Analyzing playlist url ${playlistUrl}`);
console.log();

downloadPlaylist(playlistUrl);

function markVideoAsDownloaded(videoId, videoTitle) {

    let playlistInfo = JSON.parse(fs.readFileSync(playlistInfoFile, 'utf8'));

    playlistInfo.videos = playlistInfo.videos || [];

    if (playlistInfo.videos.every(v => v.id !== videoId)) {
        playlistInfo.videos.push({
            id: videoId,
            title: videoTitle
        });
    }

    fs.writeFileSync(playlistInfoFile, JSON.stringify(playlistInfo, null, 4), { encoding: 'utf8' });
}

function videoAlreadyDownloaded(videoId) {

    let playlistInfo = JSON.parse(fs.readFileSync(playlistInfoFile, 'utf8'));

    return playlistInfo.videos && playlistInfo.videos.some(v => v.id === videoId);
}

function downloadPlaylist(url) {

    var video = youtubedl(url, ['-f mp4']);

    video.on('error', (err) => {
        console.log('Error while downloading Youtube playlist');
        console.error(err);
    });

    let size = 0;

    let videoId = null;
    let videoTitle = null;
    let outputFile = null

    video.on('info', info => {

        videoId = info.id;
        videoTitle = info.title;

        console.log(`Processing ${info.title} - ${videoId}`);

        let output = path.join(playlistDir, `${info._filename}.mp4`);

        outputFile = output;

        if (!videoAlreadyDownloaded(videoId)) {
            video.pipe(fs.createWriteStream(output));
        } else {
            console.log(`Skipping ${info.title} because it has already been downloaded`);
        }
    });

    let pos = 0;

    video.on('data', chunk => {

        pos += chunk.length;

        if (size) {

            let percent = (pos / size * 100).toFixed(2);

            process.stdout.cursorTo(0);
            process.stdout.clearLine(1);
            process.stdout.write(percent + '%');
        }
    });

    video.on('next', downloadPlaylist);

    video.on('end', () => {

        console.log(`Finished processing ${videoTitle}`);

        if (!videoAlreadyDownloaded(videoId)) {
            
            console.log(`Adding ${videoTitle} in Winamp`);

            exec(`${winampPath} /ADD "${outputFile}"`, (err, stdout, stderr) => {

                let errorOutput = stderr.toString().trim();
                let standardOutput = stdout.toString().trim();

                if (errorOutput) {
                    console.log(`Error while adding video ${videoTitle} in Winamp`);
                    console.error(errorOutput);
                } else {
                    markVideoAsDownloaded(videoId, videoTitle);
                    console.log(`Successfully added ${videoTitle} in Winamp`);
                    if (standardOutput) {
                        console.log('Winamp STDOUT:')
                        console.log(standardOutput);
                    }
                }

                console.log();
            });
        } else {
            console.log();
        }
    });
}
