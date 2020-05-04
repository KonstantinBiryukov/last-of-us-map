<template>
    <div class="wrapper">
        <div class="card">
            <span class="test">{{ name }}</span>
        </div>
    </div>
</template>

<script>
    export default {
        name: "DescriptionCard",
        props: {
            name: {
                type: String
            }
        }
    }
</script>

<style scoped>
        .card {
            width: 270px;
            height: 400px;
            background-color: black;
            position: absolute;
            top: 0.5vh;
            left: 0.5vh;
            z-index: 1;
        }

        .test {
            font-size: 20px;
            color: white;
        }
</style>