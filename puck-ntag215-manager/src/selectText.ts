export function selectText(el: HTMLElement) {
  let sel: Selection
  let range

  if (window.getSelection && document.createRange) { //Browser compatibility
      sel = window.getSelection()
      if (sel.toString() === '') { //no text selection
          window.setTimeout(() => {
              range = document.createRange() //range object
              range.selectNodeContents(el) //sets Range
              sel.removeAllRanges() //remove all ranges from selection
              sel.addRange(range) //add Range to a Selection.
          }, 1)
      }
  }
}

export function selectThis(this: HTMLElement) {
  selectText(this)
}
