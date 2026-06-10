class Example extends Phaser.Scene {

    preload() {

        this.load.image(
            "logo",
            "../../images/perrocajeto.png"
        );

    }

    create() {

        const logo = this.add.image(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            "logo"
        );

        logo.setScale(0.25);

        Phaser.Actions.AddEffectShine(logo);

    }

}

const config = {

    type: Phaser.AUTO,

    parent: "game-container",

    width: 500,
    height: 300,

    backgroundColor: "#f4f6f9",

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },

    scene: Example

};

new Phaser.Game(config);