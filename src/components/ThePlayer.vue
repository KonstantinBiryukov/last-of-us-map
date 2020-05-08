<template>
    <div class="player-wrapper">
        <button class="play" @click="play()"></button>
        <button class="stop" @click="stop()"></button>

        <!--<audio src="sound.mp3" controls></audio>-->
    </div>
</template>

<script>
    import {Howl, Howler} from "howler";

    export default {
        name: "ThePlayer",
        data() {
            return {
                song: Object,
            }
        },
        created() {
            this.song = new Howl({
                src: ["server/assets/music/1_Seasons.mp3"]
            });
            this.song.play();
        },
        methods: {
            play() {
                this.song.stop();
                this.song.play();

            },
            stop() {
                this.song.stop();
            }
        }
    }
</script>

<style scoped>
    .stop,
    .play {
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

    .stop:before,
    .play:before {
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

    .stop:before {
        border-color: #af1000;
        right: 0;
    }

    .play:before {
        border-color: transparent transparent transparent #af1000;
        right: -5px;
    }

    .play:hover,
    .stop:hover {
        background: #202020;
    }

</style>