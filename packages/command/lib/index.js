class Command {
  constructor(instance) {
    if (!instance) {
      throw new Error('command 不能为空!!!')
    }

    this.program = instance

    const cmd = this.program.command(this.command)
    cmd.description(this.description)
    cmd.hook('preAction', () => {
      this.preAction()
    })
    cmd.hook('postAction', () => {
      this.postAction()
    })
    if (this.options.length > 0) {
      this.options.forEach(option => {
        cmd.option(...option)
      })
    }
    cmd.action((...params) => {
      this.action(params)
    })
  }

  get command() {
    throw new Error('command 必须由子类实现!!!')
  }

  get description() {
    throw new Error('description 必须由子类实现!!!')
  }

  get options() {
    return []
  }

  get action() {
    throw new Error('action 必须由子类实现!!!')
  }

  preAction() {
    // empty
  }

  postAction() {
    // empty
  }
}

export default Command