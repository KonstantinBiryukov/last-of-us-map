import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex);

const mapboxgl = require('mapbox-gl/dist/mapbox-gl.js');
// const token = "pk.eyJ1Ijoia29uc3RhbnRpbmJpcml1a292IiwiYSI6ImNrMWsxYjc1bjBrdjQzZHBiNTlhbjBqdmwifQ.vAlGhe7KTCajh5VvGfMJow"; // my personal
const token = 'pk.eyJ1IjoibG9iZW5pY2hvdSIsImEiOiJjajdrb2czcDQwcHR5MnFycmhuZmo4eWwyIn0.nUf9dWGNVRnMApuhQ44VSw';

const style = "mapbox://styles/mapbox/dark-v10";

export default new Vuex.Store({
    state: {
        mapboxgl: mapboxgl,
        map: "",
        // markers: [],
        // cards: [],
        currentCard: null,
        pathCards: [],
        photos: [],
        currentPhoto: "",
        previousPhoto: ""
    },
    getters: { // = computed properties
        createMap: (state) => (container, interactive) => {
            mapboxgl.accessToken = token;
            state.map = new state.mapboxgl.Map({
                container: container,
                style: style,
                interactive: interactive,
                minzoom: 5
            });
            return state.map;
        },
    },
    mutations: {
        changeShowCardState(state, marker) {
            (!state.currentCard) ? state.currentCard = marker : state.currentCard = null;
        },
        pushPathCard(state, pathCard) {
            state.pathCards.push(pathCard);
            state.photos.push(pathCard.photo);
        },
        defineCurrentCard() {
            // state.currentPhoto = state.photos[1];
            // console.log(state.currentPhoto)
        }
    },
    actions: {
        fetchMarkers({state, commit}) {
            let url = "server/info/markers.geojson";

            state.map.on('load', () => {
                fetch(url)
                    .then(response => response.json())
                    .then((data) => {
                        state.map.addSource("locations", {
                            type: 'geojson',
                            data: data
                        });

                        data.features.forEach((marker) => {

                            const el = document.createElement('div');
                            el.className = 'marker';

                            el.style.backgroundImage =
                                'url(' + marker.properties.icon + ')';
                            el.style.width = marker.properties.iconSize[0] + 'px';
                            el.style.height = marker.properties.iconSize[1] + 'px';

                            el.addEventListener('click', () => {
                                commit('changeShowCardState', marker);
                            });

                            // make a marker for each feature and add to the map
                            new state.mapboxgl.Marker(el)
                                .setLngLat(marker.geometry.coordinates)
                                .addTo(state.map);
                        });
                    });
            });
        },
        fetchPathCards({state, commit}) {
            let url = "server/info/path_cards.json";

            state.map.on('load', () => {
                fetch(url)
                    .then(response => response.json())
                    .then((data) => {

                        data.cards.forEach((card) => {
                            let parsedCard = JSON.parse(JSON.stringify(card)); // to get rid of Observer
                            commit('pushPathCard', parsedCard);
                        });
                        // commit('defineCurrentCard', 1);
                        state.currentPhoto = state.photos[0];
                        state.previousPhoto = state.photos[0];
                    });
            });
        }
    }
});