@echo off
setlocal
set "ROOT=%~dp0"
set "MALESAN_YTDLP_PATH=%ROOT%tools\yt-dlp.exe"
set "MALESAN_FFMPEG_PATH=%ROOT%tools\ffmpeg.exe"
"%ROOT%runtime\node.exe" "%ROOT%src\index.mjs"