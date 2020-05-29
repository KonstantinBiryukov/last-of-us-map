<template>
    <div id="nav">
        <div class="menu-title">MODES:</div>
        <div class="route-menu-item"
             @mouseover="playClick('click')"
             @mouseleave="stopClick('click')">
            <router-link to="/path">FOLLOW 'THE LAST OF US' PATH
            </router-link>
        </div>
        <div class="route-menu-item"
             @mouseover="playClick('click')"
             @mouseleave="stopClick('click')">
            <router-link to="/map">INTERACTIVE MAP
            </router-link>
        </div>
        <div class="route-menu-item about"
             @mouseover="playClick('click')"
             @mouseleave="stopClick('click')">
            <router-link to="/about">ABOUT
            </router-link>
            <audio id='click'
                   src='server/assets/music/click.m4a'>
            </audio>
        </div>

    </div>
</template>

<script>
    export default {
        name: "MainPageNavBar",
        methods: {
            playClick(click) {
                document.getElementById(click).play();
            },
            stopClick(click) {
                let clickSound = document.getElementById(click);
                clickSound.pause();
                clickSound.currentTime = 0;
            }
        }
    }
</script>

<style scoped lang="scss">
    #nav {
        width: 40%;
        /*height: 100px;*/
        color: white;
        margin-top: 10vh;
        margin-left: 10vh;
        font-size: 4vh;
        text-align: left;

        .menu-title {
            color: #af1000;
            padding-bottom: 20px;
        }

        .route-menu-item {
            /*padding-bottom: 10px;*/
        }

        a {
            color: white;
            text-decoration: none;
        }

        a:hover {
            font-weight: bold;
            color: darkred;
            margin-left: 15px;
            transition: 0.3s ease;
        }

        .route-menu-item.about {
            margin-top: 30px;
        }
    }

    @media screen and (max-width: 600px) {
        .description {
            width: 200px;
        }

        .modes {
            font-size: 10px; //15px
        }

    }

    @media screen and (max-width: 500px) {

        #nav {
            width: 300px;
        }
        a {
            font-size: 15px;
        }
    }
</style>