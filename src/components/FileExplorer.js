import preact from 'preact'
/** @jsx preact.h */

import SearchBar from './SearchBar'
import Node from './Node'

import DOMHelper from '../utils/DOMHelper'
import treeParser from '../utils/treeParser'
import VisibleNodesGenerator from '../utils/VisibleNodesGenerator'

export default class List extends preact.Component {
  state = {
    // generated by this.visibleNodesGenerator
    visibleNodes: null,
  }

  props = {
    treeData: null,
    metaData: null,
  }

  tasksAfterRender = []
  visibleNodesGenerator = new VisibleNodesGenerator()

  componentWillMount() {
    const { treeData, metaData } = this.props
    const { root, nodes } = treeParser.parse(treeData, metaData)
    this.visibleNodesGenerator.plantTree(root, nodes)
    this.updateVisibleNodes()
    this.tasksAfterRender.push(DOMHelper.focusFileExplorer)
    this.tasksAfterRender.push(DOMHelper.focusSearchInput)
  }

  componentDidMount() {
    this.execAfterRender()
  }

  componentDidUpdate(prevProps, prevState) {
    this.execAfterRender()
  }

  execAfterRender() {
    for (const task of this.tasksAfterRender) {
      task()
    }
    this.tasksAfterRender.length = 0
  }

  updateVisibleNodes() {
    const { visibleNodes } = this.visibleNodesGenerator
    this.setState({ visibleNodes })
    this.tasksAfterRender.push(() => DOMHelper.attachPJAX('gitako'))
  }

  handleKeyDown = event => {
    const { key } = event
    const { visibleNodes: { nodes, focusedNode, expandedNodes, depths } } = this.state
    let shouldStopPropagation = true // prevent body scrolling
    if (focusedNode) {
      const focusedNodeIndex = nodes.indexOf(focusedNode)
      switch (key) {
        case 'ArrowUp':
          // focus on previous node
          if (focusedNodeIndex === 0) {
            this.focusNode(null)
            this.tasksAfterRender.push(DOMHelper.focusSearchInput)
          } else {
            this.focusNode(nodes[focusedNodeIndex - 1])
          }
          break

        case 'ArrowDown':
          // focus on next node
          if (focusedNodeIndex + 1 < nodes.length) {
            this.focusNode(nodes[focusedNodeIndex + 1])
          } else {
            this.focusNode(null)
            this.tasksAfterRender.push(DOMHelper.focusSearchInput)
          }
          break

        case 'ArrowLeft':
          // collapse node or go to parent node
          if (expandedNodes.has(focusedNode)) {
            this.setExpand(focusedNode, false)
          } else {
            // go forward to the start of the list, find the closest node with lower depth
            let indexOfParentNode = focusedNodeIndex
            const focusedNodeDepth = depths.get(nodes[focusedNodeIndex])
            while (
              indexOfParentNode !== -1 &&
              depths.get(nodes[indexOfParentNode]) >= focusedNodeDepth
            ) {
              --indexOfParentNode
            }
            if (indexOfParentNode !== -1) {
              this.focusNode(nodes[indexOfParentNode])
            }
          }
          break

        // consider the two keys as 'confirm' key
        case 'ArrowRight':
        case 'Enter':
          // expand node or redirect to file page
          if (focusedNode.type === 'tree') {
            this.setExpand(focusedNode, true)
          } else {
            // simulate click to trigger pjax
            DOMHelper.clickOnNodeElement(focusedNodeIndex)
          }
          break

        default:
          shouldStopPropagation = false
      }
    } else {
      // now search input is focused
      if (nodes.length) {
        switch (key) {
          case 'ArrowDown':
            this.focusNode(nodes[0])
            break
          case 'ArrowUp':
            this.focusNode(nodes[nodes.length - 1])
            break
          default:
            shouldStopPropagation = false
        }
      } else {
        shouldStopPropagation = false
      }
    }
    if (shouldStopPropagation) {
      event.stopPropagation()
      event.preventDefault()
    }
  }

  handleSearchKeyChange = async event => {
    const searchKey = event.target.value
    await this.visibleNodesGenerator.search(searchKey)
    this.updateVisibleNodes()
  }

  setExpand = (node, expand) => {
    this.visibleNodesGenerator.setExpand(node, expand)
    this.focusNode(node)
    this.tasksAfterRender.push(DOMHelper.focusSearchInput)
  }

  toggleNodeExpand = node => {
    this.visibleNodesGenerator.toggleExpand(node)
    this.focusNode(node)
    this.tasksAfterRender.push(DOMHelper.focusFileExplorer)
  }

  focusNode = node => {
    this.visibleNodesGenerator.focusNode(node)
    if (node) {
      // when focus a node not in viewport(by keyboard), scroll to it
      const { visibleNodes: { nodes } } = this.state
      const indexOfToBeFocusedNode = nodes.indexOf(node)
      this.tasksAfterRender.push(() => DOMHelper.scrollToNodeElement(indexOfToBeFocusedNode))
      this.tasksAfterRender.push(DOMHelper.focusSearchInput)
    }
    this.updateVisibleNodes()
  }

  render() {
    const { visibleNodes: { nodes, depths, focusedNode, expandedNodes } } = this.state
    return (
      <div className={`file-explorer`} tabIndex={-1} onKeyDown={this.handleKeyDown}>
        <SearchBar onSearchKeyChange={this.handleSearchKeyChange} />
        {nodes.length === 0 ? (
          <label className={'no-results'}>No results found.</label>
        ) : (
          nodes.map(node => (
            <Node
              key={node.path}
              node={node}
              depth={depths.get(node)}
              focused={focusedNode === node}
              expanded={expandedNodes.has(node)}
              toggleExpand={this.toggleNodeExpand.bind(null, node)}
            />
          ))
        )}
      </div>
    )
  }
}
