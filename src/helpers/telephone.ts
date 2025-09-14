import { intlTelInput } from './intlTelInput'

export const initTel = (selector: string) => {
  // International Telephone Input Initialize
  intlTelInputInit(document.querySelector(selector))

  document.querySelector(selector).addEventListener('keyup', () => {
    function serializeForm(form) {
      var input = form.getElementsByTagName('input')
      var formData = []
      for (var i = 0; i < input.length; i++) {
        formData.push({ name: input[i].name, value: input[i].value })
      }
      return formData
    }
    var array = serializeForm(document.querySelector('form'))
    var obj: Record<string, any> = {}

    array.forEach((array) => {
      var name = array.name
      var value = array.value

      switch (name) {
        case 'name':
          value = value.replace(/\s\s+|\t/g, ' ') || false
          break
        case 'email':
          value = value.replace(/\s+|\t/g, '').toLowerCase() || false
          break
        case 'phone':
          value = value.replace(/\s+|\t/g, '') || false
          break
        default:
          value = value || false
      }
      if (name && value) obj[name] = value
    })
  })
}

var countryCodes = {}

for (var i = 0; i < intlTelInput.countries.length; i++) {
  const element = intlTelInput.countries[i]

  if (element.prefixes) {
    if (element.prefixes.length) {
      for (var j = 0; j < element.prefixes.length; j++) {
        countryCodes[element.dialCode + element.prefixes[j]] = [element.cca2.toUpperCase()]
      }
    } else {
      countryCodes[element.dialCode] = intlTelInput.countryCodes[element.dialCode]
    }
  } else {
    countryCodes[element.dialCode] = intlTelInput.countryCodes[element.dialCode]
  }
}

/**  
 International Telephone Input Initialize 
*/
function intlTelInputInit(element) {
  var preferredCountries = []

  if (typeof intlTelInput.preferredCountries !== 'undefined' || intlTelInput.preferredCountries === null) {
    if (intlTelInput.preferredCountries.length) {
      intlTelInput.preferredCountries.forEach((countryCode) => {
        var countryData = _getCountryData(countryCode.toUpperCase())
        if (countryData[1]) preferredCountries.push(countryData[1])
      })
    }
  }

  // Combine Arrays and return a New Array. Use Concat()
  var selectedCountries = intlTelInput.preferredCountries.length
    ? preferredCountries.concat(intlTelInput.countries)
    : intlTelInput.countries

  let innerHtml = `   <div class="flag-container">
                            <div class="selected-flag">
                                <div class="flag ${selectedCountries[0].cca2}"></div>
                                <div class="arrow"></div>
                            </div>
                            </div>`
  element.insertAdjacentHTML('beforebegin', innerHtml)

  innerHtml = `<ul class="country-list"></ul>`
  element.insertAdjacentHTML('beforebegin', innerHtml)

  var countryList = element.previousElementSibling

  if (preferredCountries.length) {
    _appendListItems(countryList, preferredCountries, 'preferred')

    innerHtml = `<li class="divider"></li>`
    countryList.insertAdjacentHTML('beforeend', innerHtml)
  }

  if (intlTelInput.countries.length) _appendListItems(countryList, intlTelInput.countries, 'standard')

  element.value = `+${selectedCountries[0].dialCode}`

  var firstCountryList = countryList.querySelector('li.country')
  if (firstCountryList) firstCountryList.classList.add('active')

  _countryListEventHandler(countryList)

  // update flag on keyup
  // (by extracting the dial code from the input value)
  element.addEventListener('keyup', () => {
    var countryList = element.previousElementSibling
    var dialCodeArray = _getDialCode(element.value)

    if (dialCodeArray.prefixesDialCode) {
      var selectedFlagInner = countryList.previousElementSibling.querySelector('.selected-flag .flag')
      var countryCode = _getCountryCode(element.value, dialCodeArray.prefixesDialCode)

      // check if one of the matching country's is already selected
      if (!selectedFlagInner.classList.contains(countryCode)) _selectFlag(countryList, countryCode)
    }
  })

  // click off to close
  document.addEventListener('click', () => {
    // e.stopPropagation();
    // e.preventDefault();

    //  Close Dropdown
    _closeDropdown()
  })

  var countryListItemIndex

  document.addEventListener('keydown', (e) => {
    var activeCountryList = document.querySelector('ul.country-list.active')
    if (!activeCountryList) return
    e.stopPropagation()
    e.preventDefault()

    var countryListItems = activeCountryList.querySelectorAll('li.country')
    var activeCountryListItem = activeCountryList.querySelector('li.active')
    var highlightListItem = activeCountryList.querySelector('li.highlight')
    countryListItemIndex = highlightListItem
      ? Array.from(countryListItems).indexOf(highlightListItem)
      : Array.from(countryListItems).indexOf(activeCountryListItem)

    if (e.key === 'ArrowUp') _scrollTo(countryListItems[countryListItemIndex - 1]) // up

    if (e.key === 'ArrowDown') _scrollTo(countryListItems[countryListItemIndex + 1]) // down

    if (e.key === 'Enter') _selectListItem(countryListItems[countryListItemIndex], countryListItemIndex) // Enter

    if (e.key === 'Escape' || e.key === 'Tab') _closeDropdown() // Escape Or Tab
  })

  // update the selected flag and the active list item
  function _selectFlag(countryList, countryCode) {
    var countryData = _getCountryData(countryCode)
    var countryListItemIndex = preferredCountries.length + (countryData[0] as number)

    for (var i = 0; i < preferredCountries.length; i++) {
      if (preferredCountries[i].cca2 == countryCode) {
        countryListItemIndex = i
      }
    }

    // Country List Items again append to the Country List
    _reAppendListItems(countryList, countryListItemIndex)

    var selectedFlagInner = countryList.previousElementSibling.querySelector('.selected-flag .flag')
    selectedFlagInner.setAttribute('class', `flag ${countryCode.toLowerCase()}`)
  }

  // Select List Item From Dropdown
  function _selectListItem(countryListItem, countryListItemIndex) {
    var countryList = countryListItem.parentElement

    // Country List Items again append to the Country List
    _reAppendListItems(countryList, countryListItemIndex)

    // update selected flag
    var selectedFlagInner = countryList.previousElementSibling.querySelector('.selected-flag .flag')
    selectedFlagInner.setAttribute('class', `flag ${selectedCountries[countryListItemIndex].cca2.toLowerCase()}`)

    // update input value
    var telInputElement = countryList.nextElementSibling
    var newNumber = _updateNumber(telInputElement.value, selectedCountries[countryListItemIndex].dialCode)
    telInputElement.value = newNumber

    //  Close Dropdown
    _closeDropdown()
  }

  // check if an element is visible within it's container, else scroll until it is
  function _scrollTo(countryListItem, itemScrolled = true) {
    if (countryListItem === 'undefined' || typeof countryListItem === 'undefined') return

    var countryList = countryListItem.parentElement
    var countryListItems = countryList.querySelectorAll('li.country')
    // var countryListItemIndx = [].indexOf.call(countryListItems, countryListItem);
    var countryListItemIndex = Array.from(countryListItems).indexOf(countryListItem)
    var viewport = countryList.offsetHeight
    var itemHeight = countryListItem.offsetHeight
    var scrollTop = countryList.scrollTop
    var itemOffset = itemHeight * countryListItemIndex

    if (itemScrolled) {
      if (itemOffset + itemHeight < scrollTop || itemOffset + itemHeight > scrollTop + viewport)
        countryList.scrollTo({ top: itemOffset + itemHeight - viewport / 2 })

      // remove any highlighting from all items
      _unhighlightListItems(countryList)
    } else {
      countryList.scrollTo({ top: itemOffset + itemHeight - viewport / 2 })
    }

    countryListItem.classList.add('highlight')
  }

  // all Country List Dropdown Close
  function _closeDropdown() {
    // Unhighlight Country List Items
    _unhighlightListItems(element.previousElementSibling)

    element.previousElementSibling.classList.remove('active')

    var arrow = element.previousElementSibling.previousElementSibling.querySelector('.arrow')
    arrow.classList.remove('arrow-up')
  }

  // Unhighlight List Items From Dropdown
  function _unhighlightListItems(countryList) {
    var highlightItems = countryList.querySelectorAll('li.country.highlight')
    if (highlightItems) {
      highlightItems.forEach((highlightItem) => {
        highlightItem.classList.remove('highlight')
      })
    }
  }

  // find the country data for the given country code
  function _getCountryData(countryCode) {
    for (var i = 0; i < intlTelInput.countries.length; i++) {
      if (intlTelInput.countries[i].cca2.toUpperCase() == countryCode) {
        return [i, intlTelInput.countries[i]]
      }
    }

    return null
  }

  // replace any existing dial code with the new one
  function _updateNumber(inputVal, dialCode) {
    var dialCodeArray = _getDialCode(inputVal)
    var prevDialCode = `+${dialCodeArray.dialCode}`
    var newDialCode = `+${dialCode}`
    var newNumber

    // if the previous number contained a valid dial code, replace it
    // (if more than just a plus character)
    if (prevDialCode.length > 1) {
      newNumber = inputVal.replace(prevDialCode, newDialCode)
      // if the old number was just the dial code,
      // then we will need to add the space again
      if (inputVal == prevDialCode) newNumber += ' '
    } else if (inputVal.length && inputVal.substr(0, 1) != '+') {
      // previous number didn't contain a dial code, so persist it
      newNumber = `${newDialCode} ${inputVal.trim()}`
    } else {
      // previous number contained an invalid dial code, so wipe it
      newNumber = `${newDialCode} `
    }

    return newNumber
  }

  // Re Append country <li> to the countryList <ul> container
  function _reAppendListItems(countryList, countryListItemIndex) {
    countryList.innerHTML = ''

    if (preferredCountries.length) {
      _appendListItems(countryList, preferredCountries, 'preferred')

      var innerHtml = `<li class="divider"></li>`
      countryList.insertAdjacentHTML('beforeend', innerHtml)
    }

    if (intlTelInput.countries.length) _appendListItems(countryList, intlTelInput.countries, 'standard')

    var countryListItems = countryList.querySelectorAll('li.country')
    var countryListItem = countryListItems[countryListItemIndex]

    countryListItem.classList.add('active')

    _countryListEventHandler(countryList)
  }

  // Country List Event Handler
  function _countryListEventHandler(countryList) {
    var itemMouseEnter = false
    var countryListItems = countryList.querySelectorAll('li.country')
    var selectedFlag = countryList.previousElementSibling.querySelector('.selected-flag')

    // Selected Flag Click Event
    selectedFlag.addEventListener('click', (e) => {
      e.stopPropagation()
      e.preventDefault()

      itemMouseEnter = false

      countryList.classList.add('active')

      var arrow = selectedFlag.querySelector('.arrow')
      arrow.classList.toggle('arrow-up')

      var activeCountryListItem = countryList.querySelector('li.active')
      if (activeCountryListItem) {
        _scrollTo(activeCountryListItem, false)

        function preventDefault(e) {
          e.stopPropagation()
          e.preventDefault()
        }

        function preventDefaultForScrollKeys(e) {
          e.stopPropagation()
          e.preventDefault()

          // up: 38, down: 40,
          var keys = { 38: 1, 40: 1 }

          if (keys[e.keyCode]) {
            return false
          }

          return true
        }

        // modern Chrome requires { passive: false } when adding event
        var supportsPassive = false
        try {
          var opts = Object.defineProperty({}, 'passive', {
            get: () => {
              supportsPassive = true
            },
          })
          window.addEventListener('testPassive', null, opts)
          window.removeEventListener('testPassive', null, opts)
        } catch (_e) {}

        // call this to Disable
        function disableScroll(element) {
          element.addEventListener('scroll', preventDefault, false) // older FF
          element.addEventListener(wheelEvent, preventDefault, supportsPassive ? { passive: false } : false) // modern desktop
          element.addEventListener('touchmove', preventDefault, supportsPassive ? { passive: false } : false) // mobile
          element.addEventListener('keydown', preventDefaultForScrollKeys, false)
        }

        // call this to Enable
        function enableScroll(element) {
          element.removeEventListener('scroll', preventDefault, false) // older FF
          element.removeEventListener(wheelEvent, preventDefault, supportsPassive ? { passive: true } : false) // modern desktop
          element.removeEventListener('touchmove', preventDefault, supportsPassive ? { passive: true } : false) // mobile
          element.removeEventListener('keydown', preventDefaultForScrollKeys, false)
        }

        var wheelEvent =
          'onwheel' in document.createElement('div')
            ? 'wheel' //     Modern browsers support "wheel"
            : 'DOMMouseScroll'

        countryList.addEventListener(
          wheelEvent,
          (e) => {
            if (Math.sign(e.deltaY) < 0) {
              countryList.scrollTop <= 0 ? disableScroll(countryList) : enableScroll(countryList)
            } else if (Math.sign(e.deltaY) > 0) {
              countryList.scrollHeight - countryList.offsetHeight <= countryList.scrollTop
                ? disableScroll(countryList)
                : enableScroll(countryList)
            }
          },
          supportsPassive ? { passive: true } : false,
        )
      }
    })

    // Country List Items Click Event
    countryListItems.forEach((countryListItem, countryListItemIndex) => {
      countryListItem.addEventListener('click', (e) => {
        e.stopPropagation()
        e.preventDefault()

        // Select List Item
        _selectListItem(countryListItem, countryListItemIndex)

        //  Close Dropdown
        _closeDropdown()
      })

      // Country List Items Mouse Enter Event
      countryListItem.addEventListener('mouseenter', (e) => {
        e.stopPropagation()
        e.preventDefault()

        if (!itemMouseEnter) return
        itemMouseEnter = true

        // when mouse enter a list item, remove any highlighting from all items
        _unhighlightListItems(countryListItem.parentElement)

        countryListItem.classList.add('highlight')
      })

      countryListItem.addEventListener('mousemove', (e) => {
        e.stopPropagation()
        e.preventDefault()

        if (itemMouseEnter) return
        itemMouseEnter = true

        // when mouse over a list item, remove any highlighting from all items
        _unhighlightListItems(countryListItem.parentElement)

        // update highlighting and scroll to active list item
        countryListItem.classList.add('highlight')
      })
    })
  }

  // add a country <li> to the countryList <ul> container
  function _appendListItems(countryList, countries, className) {
    var innerHtml = ''
    // for each country list
    countries.forEach((country) => {
      innerHtml += `<li class="country ${className}">
                                <div class="flag-box">
                                    <div class="flag ${country.cca2}"></div>
                                </div>
                                <span class="country-name">${country.name}</span>
                                <span class="dial-code">+${country.dialCode}</span>
                            </li>`
    })
    countryList.insertAdjacentHTML('beforeend', innerHtml)
  }
}

/**
international Telephone Number Validation
*/

// try and extract a valid international dial code from a full telephone number
function _getDialCode(inputVal) {
  var PrefixesCountryDialCode = ''
  var countryDialCode = ''

  if (inputVal.charAt(0) == '+') {
    var prefixesDialCode = ''
    var dialCode = ''

    for (var i = 0; i < inputVal.length; i++) {
      if (
        !Number.isNaN(parseFloat(inputVal.charAt(i))) &&
        ((prefixesDialCode += inputVal.charAt(i)),
        countryCodes[prefixesDialCode] && (PrefixesCountryDialCode = inputVal.substr(0, i + 1)),
        dialCode.length == 4)
      )
        break

      if (
        !Number.isNaN(parseFloat(inputVal.charAt(i))) &&
        ((dialCode += inputVal.charAt(i)),
        countryCodes[dialCode] && (countryDialCode = inputVal.substr(0, i + 1)),
        dialCode.length == 4)
      )
        break
    }
  }

  return { dialCode: countryDialCode.replace(/\D/g, ''), prefixesDialCode: PrefixesCountryDialCode.replace(/\D/g, '') }
}

// try and extract a valid international country code from a full telephone number
function _getCountryCode(inputVal, prefixesDialCode) {
  var splitPhoneNumber = _getSplitPhoneNumber(inputVal, prefixesDialCode)
  var countryCodeArray = countryCodes[splitPhoneNumber.dialCode]
  var countryCode

  if (countryCodeArray == null) {
    countryCode = null
  } else if (countryCodeArray.length == 1) {
    countryCode = countryCodeArray[0]
  } else {
    for (var i = 0; i < countryCodeArray.length; i++) {
      if (intlTelInput.phoneNumberValidator[countryCodeArray[i]][23] != null) {
        if (0 == splitPhoneNumber.prefixes.search(intlTelInput.phoneNumberValidator[countryCodeArray[i]][23])) {
          countryCode = countryCodeArray[i]
          break
        }
      } else if (
        -1 !=
        dialCodePrefixesValidator(splitPhoneNumber.prefixes, intlTelInput.phoneNumberValidator[countryCodeArray[i]])
      ) {
        countryCode = countryCodeArray[i]
        break
      }
      countryCode = countryCodeArray[0]
    }
  }

  return countryCode
}

function dialCodePrefixesValidator(prefixes, validator) {
  return PrefixesValidator(prefixes, validator[1])
    ? PrefixesValidator(prefixes, validator[5])
      ? 4
      : PrefixesValidator(prefixes, validator[4])
        ? 3
        : PrefixesValidator(prefixes, validator[6])
          ? 5
          : PrefixesValidator(prefixes, validator[8])
            ? 6
            : PrefixesValidator(prefixes, validator[7])
              ? 7
              : PrefixesValidator(prefixes, validator[21])
                ? 8
                : PrefixesValidator(prefixes, validator[25])
                  ? 9
                  : PrefixesValidator(prefixes, validator[28])
                    ? 10
                    : PrefixesValidator(prefixes, validator[2])
                      ? validator[18] || PrefixesValidator(prefixes, validator[3])
                        ? 2
                        : 0
                      : !validator[18] && PrefixesValidator(prefixes, validator[3])
                        ? 1
                        : -1
    : -1
}

function PrefixesValidator(prefixes, validator) {
  return PrefixesValidatorMatch(prefixes, validator[3]) && PrefixesValidatorMatch(prefixes, validator[2])
}

function PrefixesValidatorMatch(prefixes, validator) {
  var PrefixesArray = 'string' == typeof validator ? prefixes.match(`^(?:${validator})$`) : prefixes.match(validator)

  return PrefixesArray && PrefixesArray[0].length == prefixes.length ? !0 : !1
}

function _getSplitPhoneNumber(inputVal, dialCode) {
  var phoneNumber = inputVal.replace(/\D/g, '')

  var splitPhoneNumber = {
    dialCode: phoneNumber.substr(0, dialCode.length),
    prefixes: phoneNumber.substr(dialCode.length, phoneNumber.length),
    phoneNumber: inputVal,
  }

  return splitPhoneNumber
}
