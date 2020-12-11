function scrollToId (id) {
  try {
    document.getElementById(id).scrollIntoView()
  } catch (e) {}
}

const headers = [].slice.call(
  document.querySelectorAll(
    '.wysiwyg h1, .wysiwyg h2, .wysiwyg h3, .wysiwyg h4, .wysiwyg h5, .wysiwyg h6'
  )
)
console.log(headers)

headers.forEach(h => {
  const link = document.createElement('a')

  link.href = `#${h.id}`
  link.style.cssText = `
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    margin: auto 0;
    transform: translateX(-100%) translateX(-8px);
  `
  link.innerHTML = `#`

  h.innerHTML = `
    ${link.outerHTML}
    <span>${h.innerHTML}</span>
  `
  h.style.cssText = `position: relative`
  h.classList.add('md-heading')
})
