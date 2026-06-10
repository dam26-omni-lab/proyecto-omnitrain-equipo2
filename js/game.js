class Example extends Phaser.Scene {

    preload() {

        this.load.image(
            'logo',
            '../../images/perrocajeto.png'
        );

    }

    create() {

        const logo = this.add.image(
            400,
            250,
            'logo'
        );

        logo.setScale(0.35);

        // efecto de brillo
        Phaser.Actions.AddEffectShine(logo);

    }

}

const config = {

    type: Phaser.AUTO,

    width: 800,
    height: 500,

    backgroundColor: '#f4f6f9',

    parent: 'game-container',

    scene: Example

};

new Phaser.Game(config);