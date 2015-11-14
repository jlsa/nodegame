#!/bin/bash
# nodeGame install from sources script
# Copyright(c) 2015 Stefano Balietti
# MIT Licensed

# Default command paths.
node_path=node
npm_path=npm

print_usage() {
    echo "Usage: install.stable.sh [--node-path=...] [--npm-path=...]"
    echo -n "  The path options select the location "
    echo "of the respective executables."
}

# Check options.
getopt_tmp=`getopt -o h --long help,node-path:,npm-path: -- "$@"`
if [ $? -ne 0 ]
then
    echo
    print_usage
    exit 1
fi

eval set -- "$getopt_tmp"
while true ; do
    case "$1" in
        -h|--help)
            print_usage
            exit 0
            shift ;;
        --node-path)
            node_path="$2"
            shift 2 ;;
        --npm-path) 
            npm_path="$2"
            shift 2 ;;
        --) shift ; break ;;
        *) echo "Error parsing options!" ; exit 1 ;;
    esac
done

# Check existence of executables.
command -v $node_path > /dev/null || {
    echo "Invalid node path at '$node_path'."
    echo
    print_usage
    exit 1
}
command -v $npm_path > /dev/null || {
    echo "Invalid npm path at '$npm_path'."
    echo
    print_usage
    exit 1
}

# Check node.js version, must be at least 0.10.
node_version=$($node_path --version)  # e.g. "v0.10.20"
node_version=${node_version#v}  # e.g. "0.10.20"
node_major=$(cut -d. -f1 <<< $node_version)
node_minor=$(cut -d. -f2 <<< $node_version)
if (( node_major <= 0 && node_minor < 10 ))
then
    echo "node.js version >= 0.10 required."
    exit 1
fi

# Check npm version, must be at least 1.3.
npm_version=$($npm_path --version)
npm_major=$(cut -d. -f1 <<< $npm_version)
npm_minor=$(cut -d. -f2 <<< $npm_version)
if (( npm_major < 1 || npm_major == 1 && npm_minor < 3 ))
then
    echo "npm version >= 1.3 required."
    echo
    print_usage
    exit 1
fi

# Return on failure immediately.
set -e

# Clone the main repo.
git clone https://github.com/nodeGame/nodegame.git
cd nodegame

# Install the dependencies.
$npm_path install nodegame-client
$npm_path install nodegame-server
$npm_path install nodegame-window
$npm_path install nodegame-widgets
$npm_path install JSUS
$npm_path install NDDB
$npm_path install shelf.js
$npm_path install descil-mturk
$npm_path install nodegame-db
$npm_path install nodegame-mongodb
$npm_path install nodegame-generator
$npm_path install smoosh
$npm_path install ya-csv
$npm_path install commander
$npm_path install docker

# Link to nodegame-generator executable.
ln -s ../node_modules/nodegame-generator/bin/nodegame bin/

# Entering nodegame-server directory.
cd node_modules/nodegame-server
 
# Patching express connect.
#patch node_modules/express/node_modules/connect/lib/middleware/static.js < \
#  bin/ng.connect.static.js.patch
 
# Rebuild js files.
cd bin
$node_path make build-client -a -o nodegame-full

# Install ultimatum game.
cd ../../..
git clone https://github.com/nodeGame/ultimatum games/ultimatum


# Execute the following commands to try out the ultimatum game.

# Start the ultimatum game:
# node start/ultimatum-server

# Open two browser tabs for two players at the address:
# http://localhost:8080/ultimatum/
# Open the admin console at:
# http://localhost:8080/ultimatum/monitor.htm
# See the wiki documentation to modify settings.
