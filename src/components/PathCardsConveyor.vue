<template>
    <div class="scroll-story">
        <!--AUTO_SCROLL-->
        <!--<div class="path-wrapper" v-for="(pathCard, index) in pathCards" :id="index" :key="index">-->
        <!--<div v-if="!pathCard.chapter" class="path-card">-->
        <!--&lt;!&ndash;<div class="path-card-title">{{pathCard.title}}</div>&ndash;&gt;-->
        <!--<br>-->
        <!--<img class="path-card-photo" :src="pathCard.photo" alt="pathCard.title">-->
        <!--&lt;!&ndash;<div class="path-card-description">{{pathCard.description}}</div>&ndash;&gt;-->
        <!--</div>-->
        <!--<div v-else class="path-chapter">-->
        <!--<div class="path-card-chapter">{{pathCard.chapter}}</div>-->
        <!--</div>-->
        <!--</div>-->
        <!--<div id="finish"></div>-->

        <!--<img id="output"/>-->


        <!--GSAP TEST-->
        <div class="box">
            <!--<transition-group @appear="animateImage"-->
            <!--tag="div">-->

            <!--<div v-for="(pathCard, index) in pathCards" :id="index" :key="index">-->
            <!--<div v-for="pathCard in pathCards" v-bind:key="pathCard.id">-->
            <img class="test-image" alt="x"
                 :src="this.$store.state.currentPhoto"/>
            <div class="overlay">
                <img class="path-card" :src="this.$store.state.previousPhoto"
                     alt="currentCardShow.title"/>
                <!--src="https://cdn.mos.cms.futurecdn.net/YnWdeaWxdgSZ8ZS5XY8Am9-1024-80.jpg.webp"-->
                <!--src="server/assets/card_images/austin_card.png"/>-->
                <!--<img class=" overlay path-card" src="server/assets/card_images/austin_card.png"-->
                <!--</div>-->
            </div>
            <!--</transition-group>-->
        </div>
    </div>


</template>

<script>
    import store from "../store/index"

    export default {
        name: "PathCard",
        data() {
            return {
                currentCardShow: null,
                currentId: 1,
                previousId: 0,
                pathCards: [],
                previousCard: this.$store.state.currentPhoto
            }
        },
        watch: {

            // pathCards() {
            //     return store.state.pathCards;
            //   }
        },
        created() {
            this.pathCards = store.state.pathCards;
        },
        mounted() {
            // const delayLoop = (fn, delay) => {
            //     return (x, i) => {
            //         setTimeout(() => {
            //             fn(x);
            //         }, i * delay);
            //     };
            // };

//             const names = [ "http://localhost:8080/server/assets/card_images/austin_card.png", "http://localhost:8080/server/assets/card_images/boston_card.png", "http://localhost:8080/server/assets/card_images/jackson_icon.jpg"
//             ];
//
//             const output = document.querySelector("#output");
//
// // const display = s => output.innerText = s;
//
//             const display = s => {
//                 output.setAttribute("src", s);
//             };
//
// // names.forEach(display);
//             names.forEach(delayLoop(display, 3000));

            // this.startScroll();
            // this.updateCard();
            // setInterval(this.updateCard(), 3000);
            // console.log(this.pathCards.filter(obj => {
            //     return obj.id === 4
            // }));

            // this.pathCards.forEach((card, index) => {
            //     setTimeout(() => {
            //         console.log(card)
            //     }, index * 3000)
            // });
            // this.pathCards.forEach((card, index) => {
            //     setTimeout(() =>  {
            //         this.currentCardShow(card);
            //         console.log(this.currentCardShow)
            //     }, index * 5000 );
            // });

            gsap.set(".box", {perspective: 500});

            setTimeout(() => {
                gsap.fromTo(".test-image", 10,
                    {opacity: 0.1}, //0.8
                    {
                        // delay: 1.9,
                        opacity: 0.98,
                        // duration: 8,
                        z: 100,
                        // transformOrigin: "50% 50%",
                        repeat: -1,
                        // repeatDelay: 1,
                        onRepeat: this.updatePhoto,
                        // repeat: 0,
                        ease: "expo.out"
                    });


            gsap.fromTo(".overlay", 10,
                // {skewX: 30, scale: 1.5},
                {skewX: 2, skewY: 2, scale: 1.1, opacity: 1}, // opactity: 0.9 skewY: -5
                {
                    // delay: 2,
                    opacity: 0.7, /// opacity: 0.1

                    skewX: 0,
                    xPercent: -100,
                    yPercent: -100,

                    // transformOrigin: "0% 100%",
                    transformOrigin: "0% 0%",

                    repeat: -1,
                    // repeatDelay: 1,
                    // repeat: 10,
                    onRepeat: this.updatePreviousPhoto,
                    // onRepeatParams: ["this.currentId"],
                    // repeat: 0,
                    ease: "expo.out" // ease: Power2.easeOut

                }
            );


            }, 10000);
        },
        beforeDestroy() {
            this.currentId = 1;
            this.previousId = 0;
        },
        // mounted() {
        // gsap.set(".box", {perspective: 500});

        // console.log(1);
        // gsap.fromTo(".overlay", 10,
        //     // {skewX: 30, scale: 1.5},
        //     {skewX: 2, skewY: -5, scale: 1.1, opacity: 0.9},
        //     {
        //         delay: 0,
        //         // opacity: 0.9,
        //         opacity: 0.1,
        //
        //         skewX: 0,
        //         xPercent: -100,
        //         yPercent: -100,
        //
        //         // transformOrigin: "0% 100%",
        //         transformOrigin: "0% 0%",
        //
        //         repeat: -1,
        //         repeatDelay: 1,
        //
        //         // repeat: 0,
        //         ease: "expo.out" // ease: Power2.easeOut
        //     }
        // );
        //
        // gsap.fromTo(".box img", 10,
        //     {opacity: 0.8},
        //     {
        //         delay: 0,
        //         opacity: 0.98,
        //         duration: 8,
        //         z: 100,
        //         // transformOrigin: "50% 50%",
        //         repeat: -1,
        //         repeatDelay: 1,
        //         // repeat: 0,
        //         ease: Power2.easeOut
        //     });
        // },
        methods: {
            updatePhoto(){
                store.state.currentPhoto = store.state.photos[this.currentId];
                this.currentId++;
                console.log("current  " + this.currentId);
            },
            updatePreviousPhoto() {
                store.state.previousPhoto = store.state.photos[this.previousId];
                this.previousId++;
                console.log("previousId  " + this.previousId);

                // console.log(this.currentCardShow);
                // console.log(this.currentCardShow)
            },
            // startScroll() {
            //     $('.scroll-story').fadeIn('slow', () => {
            //         // $('.scroll-story').stop().animate(
            //         //     {scrollTop: $('#finish').offset().top},
            //         //     40000);
            //         this.pathCards.forEach((card, index) => {
            //
            //             $('.scroll-story').animate({
            //                 scrollTop: $('#' + index).offset().top + 100,
            //             }, 100);
            //
            //             // progress: setTimeout(() => { console.log(index);
            //             // }, 1000) // delay
            //
            //             // this.delay();
            //         });
            //
            //     });
            // },
            animateImage(index) {
                console.log(index);
                gsap.fromTo(".overlay", 10,
                    // {skewX: 30, scale: 1.5},
                    {skewX: 2, skewY: -5, scale: 1.1, opacity: 0.9},
                    {
                        delay: 0,
                        // opacity: 0.9,
                        opacity: 0.1,

                        skewX: 0,
                        xPercent: -100,
                        yPercent: -100,

                        // transformOrigin: "0% 100%",
                        transformOrigin: "0% 0%",

                        repeat: -1,
                        repeatDelay: 1,

                        // repeat: 0,
                        ease: "expo.out" // ease: Power2.easeOut
                    }
                );

                gsap.fromTo(".box img", 10,
                    {opacity: 0.8},
                    {
                        delay: 0,
                        opacity: 0.98,
                        duration: 8,
                        z: 100,
                        // transformOrigin: "50% 50%",
                        repeat: -1,
                        repeatDelay: 1,
                        // repeat: 0,
                        ease: Power2.easeOut
                    });
            }
        }
    }
</script>

<style scoped lang="scss">
    .path-card {
        /*width: 9.5rem;*/
        /*height: 7rem;*/
        /*padding: 5rem 5rem 5rem 5rem;*/
        /*width: 400px;*/
        width: 100%;
        /*height: 300px;*/
        /*height: 200px;*/
        height: 100%;
        /*height: 100%;*/
        margin: 0 0 20rem 0;
        /*border: 1px solid #333;*/
        background-color: transparent;
        justify-content: center;
        display: block;

        /*box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);*/
        /*border-radius: 5px;*/


        .path-card-photo {
            /*width: 400px;*/
            width: 100%;
            height: 300px;
            /*width: 18rem;*/
            /*width: 100%;*/
            /*height: 100%*/
            /*height: 12rem;*/
        }

    }

    .path-chapter {
        width: 18rem;
        height: 2rem;
        background-color: black;
        color: darkred;
        font-weight: bold;
        font-size: 40px;
        margin: 10rem 0;
    }

    .scroll-story {
        background-color: transparent;
        opacity: 0.99;
        top: 15vh;
        height: 100%;
        /*width: 27%;*/
        padding-top: 30px;
        padding-left: 5px;

        width: 35%;
        z-index: 1;
        overflow-y: auto;
        position: fixed;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* Internet Explorer 10+ */
    }

    .scroll-story::-webkit-scrollbar { /* WebKit */
        width: 0;
        height: 0;
    }

    /*GSAP TEST */
    .box {
        /*width: 500px;*/
        width: 100%;
        height: 300px;
        position: relative;
        overflow: hidden;
        /*backface-visibility: hidden;*/
    }

    .overlay {
        position: absolute;
        left: 0;
        top: 0;
        background-color: black;
        /*opacity: 0.9;*/
        opacity: 1;
        width: 100%;
        height: 100%;
    }

    .test-image {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
    }

    /*!* VUE_Transitions *!*/
    /*.list-enter-active, .list-leave-active {*/
        /*transition: all 10s;*/
    /*}*/

    /*.list-enter, .list-leave-to !* .list-leave-active below version 2.1.8 *!*/
    /*{*/
        /*opacity: 0;*/
        /*transform: translateY(30px);*/
    /*}*/


    /*#output {*/
        /*margin-top: 25px;*/
        /*font-size: 21px;*/
        /*text-align: center;*/
        /*animation: fadein 2s;*/
        /*-moz-animation: fadein 2s; !* Firefox *!*/
        /*-webkit-animation: fadein 2s; !* Safari and Chrome *!*/
        /*-o-animation: fadein 2s; !* Opera *!*/
    /*}*/
    /*@keyframes fadein {*/
        /*from {*/
            /*opacity:0;*/
        /*}*/
        /*to {*/
            /*opacity:1;*/
        /*}*/
    /*}*/
    /*@-moz-keyframes fadein { !* Firefox *!*/
        /*from {*/
            /*opacity:0;*/
        /*}*/
        /*to {*/
            /*opacity:1;*/
        /*}*/
    /*}*/
    /*@-webkit-keyframes fadein { !* Safari and Chrome *!*/
        /*from {*/
            /*opacity:0;*/
        /*}*/
        /*to {*/
            /*opacity:1;*/
        /*}*/
    /*}*/
    /*@-o-keyframes fadein { !* Opera *!*/
        /*from {*/
            /*opacity:0;*/
        /*}*/
        /*to {*/
            /*opacity: 1;*/
        /*}*/
    /*}*/
</style>