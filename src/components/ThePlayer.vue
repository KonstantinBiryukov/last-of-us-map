<template>
    <div class="player-wrapper">
        <button class="play" @click="play()"></button>
        <button class="stop" @click="stop()"></button>
        <button class="next" @click="next()"></button>
    </div>
</template>

<script>
    import {Howl, Howler} from "howler";

    export default {
        name: "ThePlayer",
        data() {
            return {
                currentTrack: 1,
                music: Object,
                song1: Object,
                song2: Object,
                song3: Object,
                song4: Object
            }
        },
        mounted() {
            this.song1 = this.addSong("server/assets/music/1_Seasons.mp3");
            this.song2 = this.addSong("server/assets/music/2_All_Gone(No_Escape).mp3");
            this.song3 = this.addSong("server/assets/music/3_The_Path_(Vacant).mp3");
            this.song4 = this.addSong("server/assets/music/4_The_Path.mp3");

            this.afterPlaying(this.song1, this.song2);
            this.afterPlaying(this.song2, this.song3);
            this.afterPlaying(this.song3, this.song4);
            this.afterPlaying(this.song4, this.song1);

            this.play();
        },
        methods: {
            addSong(src) {
                return new Howl({
                    src: src,
                    loop: false,
                });
            },
            afterPlaying(current, next) {
                current.on('end', () => {
                    next.play();
                });
            },
            play1: function () {
                this.stop();
                this.currentTrack = 1;
                this.song1.play();
            },
            play2: function () {
                this.stop();
                this.currentTrack = 2;
                this.song2.play();
            },
            play3: function () {
                this.stop();
                this.currentTrack = 3;
                this.song3.play();
            },
            play4: function () {
                this.stop();
                this.currentTrack = 4;
                this.song4.play();
            },
            play() {
                this.stop();
                if (this.currentTrack === 1) {
                    this.play1();
                } else if (this.currentTrack === 2) {
                    this.play2();
                } else if (this.currentTrack === 3) {
                    this.play3();
                } else if (this.currentTrack === 4) {
                    this.play4();
                }
            },
            stop() {
                if (this.currentTrack === 1) {
                    this.song1.stop();
                } else if (this.currentTrack === 2) {
                    this.song2.stop();
                } else if (this.currentTrack === 3) {
                    this.song3.stop();
                } else if (this.currentTrack === 4) {
                    this.song4.stop();
                }
            },
            next() {
                if (this.currentTrack === 1) {
                    this.play2();
                } else if (this.currentTrack === 2) {
                    this.play3();
                } else if (this.currentTrack === 3) {
                    this.play4();
                } else if (this.currentTrack === 4) {
                    this.play1();
                }
            }
        }
    }
</script>

<style scoped>
    .stop,
    .play,
    .next {
        background: #282828;
        border-radius: 40px;
        border: #af1000;
        height: 40px;
        position: absolute;
        width: 40px;
        top: 0;
        bottom: 0;
        left: 0;
    }

    .play {
        margin: 5px 10px;
        right: 0;
    }

    .stop {
        margin: 5px 60px;
        right: 13vh;
    }

    .next {
        margin: 5px -40px;
    }

    .stop:before,
    .play:before,
    .next:before {
        content: "";
        display: block;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 8px 0 8px 16px;
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        margin: auto;
    }

    .next:before {
        border-width: 8px 0 8px 16px;
        left: -5px;
    }

    .next:after {
        content: "";
        display: block;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 8px 0 8px 14px;
        position: absolute;
        top: 0;
        left: 0;
        bottom: 0;
        margin: auto;
    }

    .next:after {
        border-color: transparent transparent transparent #af1000;
        right: -16px;
    }

    .stop:before {
        border-color: #af1000;
        right: 0;
    }

    .play:before,
    .next:before {
        border-color: transparent transparent transparent #af1000;
        right: -5px;
    }

    .play:hover,
    .stop:hover,
    .next:hover {
        background: #202020;
    }

</style>