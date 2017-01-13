#!/usr/bin/env node

'use strict';

const youtubedl = require('youtube-dl');
const fs = require('fs');
const path = require('path');
const exec = require('child_process').exec;

let program = require('commander');

program.version('0.0.1')
    .option('-p, --playlist <playlist>', 'Youtube playlist id')
    .option('-o, --output <output>', 'Output directory path')
    .parse(process.argv);

const playlistId = program.playlist;
const playlistDir = program.output;

const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;

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

            exec(`winamp /ADD "${outputFile}"`, (err, stdout, stderr) => {

                markVideoAsDownloaded(videoId, videoTitle);

                console.log(`Added ${videoTitle} in Winamp`);
                console.log();
            });
        } else {
            console.log();
        }
    });
}
