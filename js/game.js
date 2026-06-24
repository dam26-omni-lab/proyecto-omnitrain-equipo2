class Example extends Phaser.Scene {

    preload() {

        this.load.image(
            "logo",
            "../../images/fondo.png"
        );

    }

    create() {

        const logo = this.add.image(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            "logo"
        );

        logo.setScale(0.50);

        Phaser.Actions.AddEffectShine(logo);

    }

}

const config = {

    type: Phaser.AUTO,

    parent: "game-container",

    width: 600,
    height: 600,

    backgroundColor: "#f4f6f9",

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },

    scene: Example

};

new Phaser.Game(config);