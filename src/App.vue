<template>
    <div id="app">

        <DefaultNavBar v-if="mainPageNotActive"></DefaultNavBar>
        <!--<div id="nav">-->
        <!--<router-link to="/">Main Page</router-link>-->
        <!--|||-->
        <!--<router-link to="/map">Interactive Mode</router-link>-->
        <!--|||-->
        <!--<router-link to="/path">Visualize the path</router-link>-->
        <!--<button @click="stop()">Stop</button>-->
        <!--<button @click="play()">Play again</button>-->
        <!--</div>-->

        <!--<div v-if="mainPageNotActive">-->
            <transition name="fade" mode="out-in">
                <router-view/>
            </transition>
        <!--</div>-->
        <!--<div v-else>-->
            <!--<router-view/>-->
        <!--</div>-->
    </div>
</template>

<script>
    import DefaultNavBar from "@/components/DefaultNavBar";

    export default {
        components: {
            DefaultNavBar,
        },
        computed: {
            mainPageNotActive() {
                return this.$route.path !== '/';
            }
        }
        //     data() {
        //         return {
        //             song: Object,
        //             showPage: false
        //         }
        //     },
        //
        //     created() {
        //         this.song = new Howl({
        //             src: ["server/music/1_Seasons.mp3"]
        //         });
        //         this.song.play();
        //     },
        //     methods: {
        //         play() {
        //             this.song.play();
        //         },
        //         stop() {
        //             this.song.stop();
        //         }
        //     }
    }
</script>

<style lang="scss">
    html {
        background-color: black;
    }

    #app {
        font-family: Avenir, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-align: center;
        color: #2c3e50;
    }

    /*#nav {*/
    /*padding: 30px;*/
    /*background-color: black;*/

    /*a {*/
    /*font-weight: bold;*/
    /*color: #2c3e50;*/

    /*&.router-link-exact-active {*/
    /*color: #42b983;*/
    /*}*/
    /*}*/
    /*}*/

    /*** TRANSITIONS ***/
    .fade-enter {
        opacity: 0;
    }

    .fade-enter-active,
    .fade-leave-active {
        transition: opacity 0.3s ease-out;
    }

    .fade-leave-to {
        opacity: 0;
    }
</style>

