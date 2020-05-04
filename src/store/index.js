import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex);

const mapboxgl = require('mapbox-gl/dist/mapbox-gl.js');
const token = "pk.eyJ1Ijoia29uc3RhbnRpbmJpcml1a292IiwiYSI6ImNrMWsxYjc1bjBrdjQzZHBiNTlhbjBqdmwifQ.vAlGhe7KTCajh5VvGfMJow";
const style = "mapbox://styles/mapbox/dark-v10";

export default new Vuex.Store({
    state: {
        markers: [],
        showCard: true,
        mapboxgl: mapboxgl,
        map: ""
    },
    getters: {
        createMap: (state) => (container) => {
            mapboxgl.accessToken = token;
            state.map = new state.mapboxgl.Map({
                container: container,
                style: style
            });
            return state.map;
        },
        fetchMarkers: state => {
            let url = "server/paths/test.geojson";

            state.map.on('load', () => {
                fetch(url)
                    .then(response => response.json())
                    .then((data) => {
                        state.map.addSource("locations", {
                            type: 'geojson',
                            data: data
                        });

                        data.features.forEach((marker) => {
                            // console.log(marker);
                            state.markers.push(marker);

                            const el = document.createElement('div');
                            el.className = 'marker';

                            el.style.backgroundImage =
                                'url(' + marker.properties.icon + ')';
                            el.style.width = marker.properties.iconSize[0] + 'px';
                            el.style.height = marker.properties.iconSize[1] + 'px';

                            el.addEventListener('click', () => {
                                alert(1);
                                // this.addCard(el, marker);
                            });

                            // make a marker for each feature and add to the map
                            new state.mapboxgl.Marker(el)
                                .setLngLat(marker.geometry.coordinates)
                                .addTo(state.map);
                        });
                    });
            });

        }
    },
    mutations: {}
    ,
    actions: {}
    ,
    modules: {}
})
