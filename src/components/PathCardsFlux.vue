<template>
    <div class="carousel">
        <vue-flux
                :options="vfOptions"
                :images="vfImages"
                :transitions="vfTransitions"
                ref="slider">

            <!--<template v-slot:preloader>-->
                <!--<flux-preloader/>-->
            <!--</template>-->
        </vue-flux>

    </div>
</template>

<script>
    import {
        VueFlux,
        // FluxPreloader
    } from 'vue-flux';

    export default {
        name: "PathCardsFlux",
        components: {
            VueFlux,
            // FluxPreloader
        },
        data: () => ({
            vfOptions: {
                autoplay: true,
                delay: 5000,
                infinite: false
            },
            vfImages: [
                'server/assets/story_telling_images/chapters/1/welcome_screen.png',
                'server/assets/story_telling_images/chapters/1/1_naughty_dog.png',
                'server/assets/story_telling_images/chapters/1/last_of_us.jpg',
                'server/assets/story_telling_images/chapters/1/2_chapter1.png',
                'server/assets/story_telling_images/chapters/1/3_year.png',
                'server/assets/story_telling_images/chapters/1/img_1.png',
                'server/assets/story_telling_images/chapters/1/img_2.jpg',
                'server/assets/story_telling_images/chapters/1/img_3.jpg',
                'server/assets/story_telling_images/chapters/1/img_4.jpg',
                'server/assets/story_telling_images/chapters/1/img_5.jpg',
                'server/assets/story_telling_images/chapters/1/img_6.jpg',
                'server/assets/story_telling_images/chapters/1/img_7.png',
                'server/assets/story_telling_images/chapters/1/img_8.png',
                'server/assets/story_telling_images/chapters/2/1_chapter2.png',
                'server/assets/story_telling_images/chapters/2/2_year.png',
                'server/assets/story_telling_images/chapters/2/img_1.jpg',
                'server/assets/story_telling_images/chapters/2/img_3.jpg',
                'server/assets/story_telling_images/chapters/2/img_4.jpg',
                'server/assets/story_telling_images/chapters/2/img_6.jpg',
                'server/assets/story_telling_images/chapters/2/img_8.jpg',
                'server/assets/story_telling_images/chapters/2/img_9.jpg',
                'server/assets/story_telling_images/chapters/3/chapter3.png',
                'server/assets/story_telling_images/chapters/3/img_0.jpg',
                'server/assets/story_telling_images/chapters/3/img_1.jpg',
                'server/assets/story_telling_images/chapters/3/img_2.jpg',
                'server/assets/story_telling_images/chapters/3/img_4.jpg',
                'server/assets/story_telling_images/chapters/3/img_5.jpg',
                'server/assets/story_telling_images/chapters/3/img_6.jpg',
                'server/assets/story_telling_images/chapters/3/img_7.jpg',
                'server/assets/story_telling_images/chapters/3/img_12.jpg',
                'server/assets/story_telling_images/chapters/3/img_14.jpg',
                'server/assets/story_telling_images/chapters/3/img_15.jpg',
                'server/assets/story_telling_images/chapters/3/img_16.jpg',
                'server/assets/story_telling_images/chapters/4/chapter4.png',
                'server/assets/story_telling_images/chapters/4/img_1.jpg',
                'server/assets/story_telling_images/chapters/4/img_2.jpg',
                'server/assets/story_telling_images/chapters/4/img_4_2.jpg',
                'server/assets/story_telling_images/chapters/4/img_5.jpg',
                'server/assets/story_telling_images/chapters/4/img_6_1.jpg',
                'server/assets/story_telling_images/chapters/4/img_6_2.jpg',
                'server/assets/story_telling_images/chapters/4/img_8_1.jpg',
                'server/assets/story_telling_images/chapters/4/img_8_2.jpg',
                'server/assets/story_telling_images/chapters/4/img_8_3.jpg',
                'server/assets/story_telling_images/chapters/4/img_9.jpg',
                'server/assets/story_telling_images/chapters/4/img_10.jpg',
                'server/assets/story_telling_images/chapters/4/img_12.jpg',
                'server/assets/story_telling_images/chapters/4/img_13.jpg',
                'server/assets/story_telling_images/chapters/4/img_14.jpg',
                'server/assets/story_telling_images/chapters/5/chapter5.png',
                'server/assets/story_telling_images/chapters/5/img_0_0.png',
                'server/assets/story_telling_images/chapters/5/img_0_1.png',
                'server/assets/story_telling_images/chapters/5/img_0_2.png',
                'server/assets/story_telling_images/chapters/5/img_1.jpg',
                'server/assets/story_telling_images/chapters/5/img_4.jpg',
                'server/assets/story_telling_images/chapters/5/img_5.jpg',
                'server/assets/story_telling_images/chapters/5/img_6_1.jpg',
                'server/assets/story_telling_images/chapters/5/img_6_2.jpg',
                'server/assets/story_telling_images/chapters/5/img_7.jpg',
                'server/assets/story_telling_images/chapters/5/img_8.jpg',
                'server/assets/story_telling_images/chapters/5/img_9.jpg',
                'server/assets/story_telling_images/chapters/5/img_10.jpg',
                'server/assets/story_telling_images/chapters/5/img_12.jpg',
                'server/assets/story_telling_images/chapters/5/img_13.jpg',
                'server/assets/story_telling_images/chapters/5/img_14.png',
                'server/assets/story_telling_images/chapters/5/img_15.jpg',
                'server/assets/story_telling_images/chapters/6/chapter6.png',
                'server/assets/story_telling_images/chapters/6/img_0_1.jpg',
                'server/assets/story_telling_images/chapters/6/img_0_2.jpg',
                'server/assets/story_telling_images/chapters/6/img_1.jpg',
                'server/assets/story_telling_images/chapters/6/img_2_1.jpg',
                'server/assets/story_telling_images/chapters/6/img_3.jpg',
                'server/assets/story_telling_images/chapters/6/img_4.jpg',
                'server/assets/story_telling_images/chapters/7/chapter7.png',
                'server/assets/story_telling_images/chapters/7/img_1.jpg',
                'server/assets/story_telling_images/chapters/7/img_2.jpg',
                'server/assets/story_telling_images/chapters/7/img_2_2.jpg',
                'server/assets/story_telling_images/chapters/7/img_3.jpg',
                'server/assets/story_telling_images/chapters/7/img_4_0.png',
                'server/assets/story_telling_images/chapters/7/img_4_1.jpg',
                'server/assets/story_telling_images/chapters/7/img_4_2.jpg',
                'server/assets/story_telling_images/chapters/7/img_4_3.jpg',
                'server/assets/story_telling_images/chapters/7/img_5.jpg',
                'server/assets/story_telling_images/chapters/7/img_6.jpg',
                'server/assets/story_telling_images/chapters/7/img_7.jpg',
                'server/assets/story_telling_images/chapters/7/img_8.jpg',
                'server/assets/story_telling_images/chapters/7/img_9.png',
                'server/assets/story_telling_images/chapters/8/chapter8.png',
                'server/assets/story_telling_images/chapters/8/img_0.jpg',
                'server/assets/story_telling_images/chapters/8/img_00.jpg',
                'server/assets/story_telling_images/chapters/8/img_000.jpg',
                'server/assets/story_telling_images/chapters/8/img_1.jpg',
                'server/assets/story_telling_images/chapters/8/img_2.jpg',
                'server/assets/story_telling_images/chapters/8/img_3.jpg',
                'server/assets/story_telling_images/chapters/8/img_4.jpg',
                'server/assets/story_telling_images/chapters/8/img_5.jpg',
                'server/assets/story_telling_images/chapters/8/img_6.jpg',
                'server/assets/story_telling_images/chapters/8/img_7.jpg',
                'server/assets/story_telling_images/chapters/9/chapter9.png',
                'server/assets/story_telling_images/chapters/9/img_0.jpg',
                'server/assets/story_telling_images/chapters/9/img_1.jpg',
                'server/assets/story_telling_images/chapters/9/img_2_1.jpg',
                'server/assets/story_telling_images/chapters/9/img_2_2.jpg',
                'server/assets/story_telling_images/chapters/9/img_3.jpg',
                'server/assets/story_telling_images/chapters/9/img_4_1.jpg',
                'server/assets/story_telling_images/chapters/9/img_4_11.jpg',
                'server/assets/story_telling_images/chapters/9/img_4_2.jpg',
                'server/assets/story_telling_images/chapters/9/img_4_3.png',
                'server/assets/story_telling_images/chapters/9/img_5.jpg',
                'server/assets/story_telling_images/chapters/9/img_6.jpg',
                'server/assets/story_telling_images/chapters/9/img_7.jpg',
                'server/assets/story_telling_images/chapters/10/chapter10.png',
                'server/assets/story_telling_images/chapters/10/img_1.jpg',
                'server/assets/story_telling_images/chapters/10/img_2.jpg',
                'server/assets/story_telling_images/chapters/10/img_3.jpg',
                'server/assets/story_telling_images/chapters/10/img_4.jpg',
                'server/assets/story_telling_images/chapters/10/img_5.jpg',
                'server/assets/story_telling_images/chapters/10/img_6.jpg',
                'server/assets/story_telling_images/chapters/10/img_6_2.png',
                'server/assets/story_telling_images/chapters/10/img_7.jpg',
                'server/assets/story_telling_images/chapters/10/img_8.jpg',
                'server/assets/story_telling_images/chapters/11/chapter11.png',
                'server/assets/story_telling_images/chapters/11/img_1.jpg',
                'server/assets/story_telling_images/chapters/11/img_2.jpg',
                'server/assets/story_telling_images/chapters/11/img_3.jpg',
                'server/assets/story_telling_images/chapters/11/img_4.jpg',
                'server/assets/story_telling_images/chapters/11/img_5.jpg',
                'server/assets/story_telling_images/chapters/11/img_6.jpg',
                'server/assets/story_telling_images/chapters/11/img_7.png',
                'server/assets/story_telling_images/chapters/12/chapter12.png',
                'server/assets/story_telling_images/chapters/12/img_1.jpg',
                'server/assets/story_telling_images/chapters/12/img_2.jpg',
                'server/assets/story_telling_images/chapters/12/img_3.jpg',
                'server/assets/story_telling_images/chapters/12/img_3_2.png',
                'server/assets/story_telling_images/chapters/12/img_4.jpeg'

            ], // good transitions: 'fade', 'blinds2d', 'explode', 'kenburn', 'slide', 'swipe'
            vfTransitions: ['slide', 'fade', 'slide', 'slide', 'slide', 'slide', 'slide', 'slide', 'slide', 'slide', 'slide', 'slide', 'slide',]
        })

    }
</script>

<style scoped>
    .carousel {
        background-color: transparent;
        opacity: 0.99;
        top: 12vh;
        height: 100%;
        padding-top: 30px;
        padding-left: 5px;

        width: 35%;
        z-index: 1;
        overflow-y: auto;
        position: fixed;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* Internet Explorer 10+ */
    }


    .vue-flux {
    }
</style>