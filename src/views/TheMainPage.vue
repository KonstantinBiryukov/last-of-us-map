<template>
    <div v-if="showPage" class="main-page">
        <img class="firefly" src="server/assets/other_images/firefly.png" alt="firefly">
        <img class="image-box" src="server/assets/large_images/main_background.jpg" alt="LAST OF US">

        <div class="layout description">
            <span class="title">
                Welcome to The Last of Us interactive map experience.<br>
                WARNING: The maps contain major spoilers, do not proceed before completing the game. 18+. Beta version: 0.2.1<br> <br>
            </span>
            <span class="modes">
                Choose one of the 2 modes: <br>
                I. "Follow The Last of Us Path" Mode will guide you through the route that Joel and Ellie has followed throughout
                the game. Just sit and enjoy their path recalling bygone events.
                Zoom scroll will be enabled only after the path is rendered.<br>
                II. Interactive Map Mode will show you the locations which took place in the game. Click on the location
                markers to check out card-descriptions which let you refresh your memory. <br>
                Recommended way to feel map experience: Turn on your speakers and keep music playing, start with the 1st mode and enjoy.
            </span>
        </div>
        <MainPageNavBar></MainPageNavBar>
        <!--<Player class="layout player"></Player>-->
    </div>
</template>

<script>
    import Player from "@/components/ThePlayer"
    import MainPageNavBar from "@/components/MainPageNavBar";

    export default {
        components: {
            Player,
            MainPageNavBar
        },
        data() {
            return {
                showPage: false
            }
        },
        mounted() {
            this.showPage = true;
        }
    }
</script>


<style scoped lang="scss">
    .description {
        padding-top: 100px;
        padding-left: 15px;
        width: 600px;
        color: red;
        font-weight: lighter;
        text-align: left;

        .title {
            font-size: 2.8vh; //18px
        }

        .modes {
            font-size: 2.2vh; //15px
        }
    }

    .firefly {
        width: 16vh; // 100px
        height: 16vh; // 100px
        position: absolute;
        left: 5vh;
    }

    .firefly:hover {
        transform: scale(1.1);
    }

    /*.layout.player {*/
    /*position: fixed;*/
    /*top: 5vh;*/
    /*right: 20vh;*/
    /*}*/

    img.image-box {
        z-index: -1;
        /* Set rules to fill background */
        min-height: 100%;
        min-width: 1024px;

        /* Set up proportionate scaling */
        width: 100%;
        height: auto;

        /* Set up positioning */
        position: fixed;
        top: 0;
        left: 0;
    }

    @media screen and (max-width: 500px) {
        .description {
            width: 200px;
        }

        .modes {
            font-size: 10px; //15px
        }

    }

    @media screen and (max-width: 1024px) { /* Specific to this particular image */
        img.image-box {
            left: 50%;
            margin-left: -512px; /* 50% */
        }
    }

    @media screen and (min-width: 1800px) {
        .description {
            width: 1000px;
            padding-top: 150px;
        }
    }
</style>