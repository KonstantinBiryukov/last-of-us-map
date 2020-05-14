<template>
    <div id="nav">
            <router-link to="/">Main Page</router-link>
            |
            <router-link to="/map">Interactive Mode</router-link>
            |
            <router-link to="/path">Visualize the path</router-link>

    </div>
</template>

<script>
    export default {
        name: "DefaultNavBar",
    }
</script>

<style scoped lang="scss">
    #nav {
        padding: 30px;
        background-color: black;

        a {
            font-weight: bold;
            color: firebrick;
            text-decoration: none;
            opacity:0.9;

            &.router-link-exact-active {
                color: lightcoral;
                opacity: 1;
            }
        }

        a:hover {
            color: red;
        }
    }
</style>