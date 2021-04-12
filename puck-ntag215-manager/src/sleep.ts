export function sleep(delay: number) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, delay)
  })
}
