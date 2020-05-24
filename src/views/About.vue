<template>
    <div class="description">
        <div class="text">
            This project will help you to remind the events that were taken place in "The Last of Us" (2013) video game.
            The map intends
            to
            give you interactive "map experience" to guide you through the path Ellie and Joel went through. You will
            see
            their path's visualization and synchronized photos together with music from the game. <br>
            - When the path visualization is finished, zoom's map will be unlocked, and you are able to explore the path
            more
            thoroughly. <br>
            - Be aware that the path is rendered in real-time on your device, and the path consists of tens of thousands
            of
            points to provide smooth rendering. This operation requires good CPU/GPU/RAM to render it fast enough to
            keep correct
            timings
            with photos and music. Good internet connection is required as well. <br>
            - Sometimes during the visualization there are gaps in the path, my intention was to decrease the quantity
            of
            points
            to render. <br>
            - Go to the Main Page to see short descriptions of the 2 modes. <br>
            - If your browser doesn't support 'autoplay' feature, use player on the top of the screen to start the
            music. <br>
            - Support of Internet Explorer and Edge is not guaranteed. <br>
        </div>
        <div class="credits">All photos are from "Last of Us" (2013) and "The Last of Us Remastered" (2014), Naughty Dog
            video game. <br> Music: "Last of Us" OST,
            Gustavo
            Santaolalla.
        </div>
        <div class="stack">Tech_stack: JS + Vue + Mapbox-gl + Howler.js</div>
    </div>
</template>

<script>
    export default {
        name: "About"
    }
</script>

<style scoped>
    .description {
        color: antiquewhite;
        max-width: 600px;
        margin: 50px auto;
    }

    .stack {
        color: aqua;
    }

    .credits {
        color: greenyellow;
        margin-bottom: 15px;
    }

    .text {
        margin-bottom: 30px;
    }

    @media screen and (min-width: 1800px) {
        .description {
            font-size: 21px;
        }
    }
</style>

