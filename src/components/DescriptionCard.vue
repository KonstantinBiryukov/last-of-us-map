<template>
    <div class="wrapper">
        <div class="card">
            <div class="title"> {{ currentCard.properties.title }}</div>
            <!--<button class="close-button">-->
                <img @click="close()" class="close-img" src="server/assets/other_images/close-icon.png" alt="close">
            <!--</button>-->
            <div class="description"> {{ currentCard.properties.description }}</div>
            <img class="card-photo" :src=currentCard.properties.photo :alt="currentCard.properties.title">
        </div>
    </div>
</template>

<script>
    import store from "../store/index"
    // import Velocity from "velocity-animate"

    export default {
        name: "DescriptionCard",
        data() {
            return {
                title: {
                    type: String
                },
                description: {
                    type: String
                },
                photo: {
                    type: String
                },
                markers: store.state.markers
            }
        },
        computed: {
            currentCard() {
                return store.state.currentCard;
            }
            // markers() {
            //     console.log(store.state.markers);
            //     return store.state.markers;
            // }
        },
        mounted() {
            // store.dispatch('fetchCards');
            // console.log(this.cards);
            // let url = "server/info/cards_data.json";
            // this.fetchCards(url);
            // console.log(this.cards);
        },
        created() {
            // fetchCards(url) {
            // let url = "server/info/cards_data.json";
            // fetch(url)
            //         .then(response => response.json())
            //         .then((data) => {
            //             data.features.forEach(card => {
            //                 store.state.cards.push(card);
            //             });
            //         });
            // // }
            // console.log(store.state.cards);
        },
        methods: {
            close() {
                store.state.currentCard = null;
            }
        }
    }
</script>

<style scoped lang="scss">
    .card {
        width: 270px;
        height: 400px;
        background-color: black;
        position: absolute;
        /*top: 0.5vh;*/
        /*left: 0.5vh;*/
        z-index: 1;
    }

    .test {
        font-size: 20px;
        color: white;
    }


    .card {
        color: navajowhite;

        .title {
            font-size: 20px;
        }

        .description {
            font-size: 12px;
            margin-top: 15px;
        }

        .card-photo {
            margin-top: 15px;
            width: 270px;
            height: auto /*height: 250px;*/
        }
    }

    .close-img {
        width: 28px;
        height: 28px;
        position: absolute;
        right: 0;
        top: 0;
        cursor: pointer;
    }
</style>